/**
 * FPV Drone & Battery Manager - Cloud Synchronization Layer
 * Bridges IndexedDB (local) and Cloud Firestore (remote) in real-time.
 */

// Firebase Configuration (obtained from the Firebase CLI)
const firebaseConfig = {
  projectId: "fpv-drone-manager-98765",
  appId: "1:285680734757:web:7b98dec06b8f2a5b8965cc",
  storageBucket: "fpv-drone-manager-98765.firebasestorage.app",
  apiKey: "AIzaSyDPSY0YN_JnyUd0e_qT-ex8XoByHniAMK4",
  authDomain: "fpv-drone-manager-98765.firebaseapp.com",
  messagingSenderId: "285680734757"
};

// Global variables
let firestoreDb = null;
let firebaseAuth = null;
let activeUnsubscribes = [];
let isInitialSyncRunning = false;

// 1. Initialize Firebase if SDK is loaded
if (window.firebase) {
  try {
    firebase.initializeApp(firebaseConfig);
    firestoreDb = firebase.firestore();
    firebaseAuth = firebase.auth();
    
    // Enable offline persistence for Firestore itself (enables offline queries & cache)
    firestoreDb.enablePersistence().catch(err => {
      if (err.code == 'failed-precondition') {
        console.warn("La persistance Firestore a échoué (plusieurs onglets ouverts).");
      } else if (err.code == 'unimplemented') {
        console.warn("Ce navigateur ne supporte pas la persistance Firestore.");
      }
    });
    
    console.log("Firebase SDK initialisé avec succès.");
  } catch (e) {
    console.error("Erreur d'initialisation de Firebase:", e);
  }
} else {
  console.warn("Firebase SDK non détecté. Mode local uniquement actif.");
}

// 2. Setup Auth state listener on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  if (!firebaseAuth) {
    // Graceful offline fallback in UI if Firebase didn't load
    const syncCard = document.getElementById('cloud-sync-card');
    if (syncCard) {
      syncCard.style.opacity = '0.6';
      const desc = syncCard.querySelector('.settings-desc');
      if (desc) {
        desc.innerHTML = "⚠️ <strong>Mode Hors-ligne (SDK non chargé) :</strong> La synchronisation automatique est temporairement indisponible. L'application continue de fonctionner localement avec IndexedDB.";
      }
      const form = document.getElementById('sync-login-form');
      if (form) form.style.display = 'none';
    }
    return;
  }

  // Bind UI elements
  const loginForm = document.getElementById('sync-login-form');
  const emailInput = document.getElementById('sync-email');
  const passwordInput = document.getElementById('sync-password');
  const btnRegister = document.getElementById('btn-sync-register');
  const btnLogout = document.getElementById('btn-sync-logout');
  
  const divLoggedOut = document.getElementById('sync-logged-out');
  const divLoggedIn = document.getElementById('sync-logged-in');
  const spanUserEmail = document.getElementById('sync-user-email');

  // Auth State Listener
  firebaseAuth.onAuthStateChanged(user => {
    if (user) {
      console.log("Utilisateur connecté au cloud:", user.email);
      
      // Update UI
      divLoggedOut.style.display = 'none';
      divLoggedIn.style.display = 'block';
      spanUserEmail.textContent = user.email;
      
      // Activate bidirectional sync
      startRealtimeSync(user.uid);
    } else {
      console.log("Aucun utilisateur connecté au cloud.");
      
      // Update UI
      divLoggedOut.style.display = 'block';
      divLoggedIn.style.display = 'none';
      
      // Terminate synchronization
      stopRealtimeSync();
    }
  });

  // Handle Login (Submit Form)
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      showToast("Connexion en cours...", "info");
      
      firebaseAuth.signInWithEmailAndPassword(email, password)
        .then(() => {
          showToast("Connexion réussie ! Vos données se synchronisent.", "success");
          loginForm.reset();
        })
        .catch(err => {
          console.error("Erreur de connexion:", err);
          showToast(translateAuthError(err.code), "error");
        });
    });
  }

  // Handle Registration
  if (btnRegister) {
    btnRegister.addEventListener('click', () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        showToast("Veuillez saisir un email et un mot de passe.", "error");
        return;
      }
      
      if (password.length < 6) {
        showToast("Le mot de passe doit contenir au moins 6 caractères.", "error");
        return;
      }
      
      showToast("Création du compte...", "info");
      
      firebaseAuth.createUserWithEmailAndPassword(email, password)
        .then(() => {
          showToast("Compte créé avec succès ! Synchro activée.", "success");
          loginForm.reset();
        })
        .catch(err => {
          console.error("Erreur d'inscription:", err);
          showToast(translateAuthError(err.code), "error");
        });
    });
  }

  // Handle Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      showToast("Déconnexion...", "info");
      firebaseAuth.signOut()
        .then(() => {
          showToast("Déconnecté du Cloud. Données conservées localement.", "success");
        })
        .catch(err => {
          showToast("Erreur lors de la déconnexion : " + err.message, "error");
        });
    });
  }
});

// 3. Bidirectional Sync Engine
function startRealtimeSync(userId) {
  // Clear any existing listeners just in case
  stopRealtimeSync();
  
  const collections = ['drones', 'batteries', 'projects', 'wishlist'];
  
  // A. INITIAL SYNC / FUSION MECHANISM
  // Check if this cloud account is brand new / empty
  isInitialSyncRunning = true;
  
  checkCloudEmpty(userId, collections)
    .then(isEmpty => {
      if (isEmpty) {
        // If cloud is empty but we have local data, perform a one-way upload of everything
        console.log("Compte Cloud vide détecté. Sauvegarde de la base locale vers le cloud...");
        return pushLocalToCloud(userId, collections);
      } else {
        console.log("Données cloud existantes détectées. Activation de l'écoute en temps réel.");
        return Promise.resolve();
      }
    })
    .then(() => {
      isInitialSyncRunning = false;
      
      // B. REGISTER INBOUND SYNC (Firestore -> IndexedDB)
      collections.forEach(storeName => {
        const unsub = firestoreDb
          .collection('users')
          .doc(userId)
          .collection(storeName)
          .onSnapshot(snapshot => {
            // Ignore own changes currently in flight to the cloud
            if (snapshot.metadata.hasPendingWrites) return;
            
            // Temporarily detach the outbound callback to prevent infinite sync loop
            const originalCallback = FPVDatabase.onSyncCallback;
            FPVDatabase.onSyncCallback = null;
            
            const dbPromises = [];
            
            snapshot.docChanges().forEach(change => {
              const docData = change.doc.data();
              const docId = change.doc.id;
              
              if (change.type === 'added' || change.type === 'modified') {
                dbPromises.push(FPVDatabase.put(storeName, docData));
              } else if (change.type === 'removed') {
                dbPromises.push(FPVDatabase.delete(storeName, docId));
              }
            });
            
            Promise.all(dbPromises)
              .then(() => {
                // Re-enable outbound callback
                FPVDatabase.onSyncCallback = originalCallback;
                
                // Refresh standard views if elements changed
                if (snapshot.docChanges().length > 0 && typeof refreshAllViews === 'function') {
                  refreshAllViews();
                }
              })
              .catch(err => {
                console.error(`Erreur d'import local de ${storeName}:`, err);
                FPVDatabase.onSyncCallback = originalCallback;
              });
          }, err => {
            console.error(`Erreur sur l'écouteur cloud ${storeName}:`, err);
          });
          
        activeUnsubscribes.push(unsub);
      });
      
      // C. REGISTER OUTBOUND SYNC (IndexedDB -> Firestore)
      FPVDatabase.onSyncCallback = (action, storeName, item) => {
        if (!firebaseAuth.currentUser || isInitialSyncRunning) return;
        const currentUserId = firebaseAuth.currentUser.uid;
        
        const docRef = firestoreDb
          .collection('users')
          .doc(currentUserId)
          .collection(storeName)
          .doc(item.id);
          
        if (action === 'put') {
          docRef.set(item).catch(err => {
            console.error(`Échec d'écriture cloud (${storeName}):`, err);
          });
        } else if (action === 'delete') {
          docRef.delete().catch(err => {
            console.error(`Échec de suppression cloud (${storeName}):`, err);
          });
        }
      };
    })
    .catch(err => {
      isInitialSyncRunning = false;
      console.error("Échec lors de l'initialisation de la synchronisation:", err);
    });
}

function stopRealtimeSync() {
  // Unsubscribe all active listeners
  activeUnsubscribes.forEach(unsub => unsub());
  activeUnsubscribes = [];
  
  // Detach outbound sync callback
  if (typeof FPVDatabase !== 'undefined') {
    FPVDatabase.onSyncCallback = null;
  }
}

// 4. Helper Functions
function checkCloudEmpty(userId, collections) {
  // Fetches a single document from each collection to see if there is any data
  const checks = collections.map(storeName => {
    return firestoreDb
      .collection('users')
      .doc(userId)
      .collection(storeName)
      .limit(1)
      .get()
      .then(snap => snap.empty);
  });
  
  return Promise.all(checks).then(results => {
    // If all collections are empty, return true
    return results.every(isEmpty => isEmpty === true);
  });
}

function pushLocalToCloud(userId, collections) {
  showToast("Première connexion : Sauvegarde de vos données locales dans le cloud...", "info");
  
  const uploadPromises = [];
  
  const getAndUpload = collections.map(storeName => {
    return FPVDatabase.getAll(storeName).then(items => {
      items.forEach(item => {
        const p = firestoreDb
          .collection('users')
          .doc(userId)
          .collection(storeName)
          .doc(item.id)
          .set(item);
        uploadPromises.push(p);
      });
    });
  });
  
  return Promise.all(getAndUpload)
    .then(() => Promise.all(uploadPromises))
    .then(() => {
      showToast("Données locales sauvegardées dans le cloud avec succès !", "success");
    })
    .catch(err => {
      console.error("Erreur de sauvegarde initiale locale vers cloud :", err);
      showToast("Échec de la sauvegarde initiale sur le cloud.", "error");
    });
}

function translateAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return "Format d'adresse email invalide.";
    case 'auth/user-disabled':
      return "Ce compte a été désactivé par l'administrateur.";
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return "Identifiants incorrects (Email ou Mot de passe erroné).";
    case 'auth/email-already-in-use':
      return "Cette adresse email est déjà associée à un compte.";
    case 'auth/weak-password':
      return "Le mot de passe choisi est trop faible (6 caractères min).";
    case 'auth/network-request-failed':
      return "Erreur réseau. Vérifiez votre connexion internet.";
    default:
      return "Une erreur de connexion est survenue. Veuillez réessayer.";
  }
}
