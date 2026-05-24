/**
 * FPV Drone & Battery Manager - Main Application Logic
 * Implements SPA routing, dynamic forms, CRUD operations, details panel rendering, and import/export.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Database
  FPVDatabase.init()
    .then(() => {
      initApp();
      refreshAllViews();
    })
    .catch(err => {
      showToast("Erreur de base de données : " + err.message, "error");
    });
});

// Global state variables
let currentView = 'home';
let activeEntity = null; // Holds the currently viewed drone/battery/project/wishlist item



/**
 * Main application initializer
 */
function initApp() {
  setupRouting();
  setupEventListeners();
  setupSearchAndFilters();
  setupInvoicePreviewClose();
}

/* ==========================================================================
   SPA ROUTING (TAB NAVIGATION)
   ========================================================================== */
function setupRouting() {
  const tabs = document.querySelectorAll('.tab-item');
  const views = document.querySelectorAll('.app-view');
  
  // Set default view on load
  const hash = window.location.hash.replace('#', '') || 'home';
  switchView(hash);

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetHash = tab.getAttribute('href').replace('#', '');
      window.location.hash = targetHash;
      switchView(targetHash);
      
      // Visual feedback tap (iOS Haptic representation)
      tab.style.transform = 'scale(0.92)';
      setTimeout(() => tab.style.transform = 'none', 100);
    });
  });

  // Favorites segmented control delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('segment-btn')) {
      document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      if (currentView === 'favorites') {
        renderFavorites();
      }
    }
  });

  // Listen to browser history navigation
  window.addEventListener('hashchange', () => {
    const targetHash = window.location.hash.replace('#', '') || 'home';
    switchView(targetHash);
  });
}

function switchView(viewName) {
  const views = {
    'home': 'view-home',
    'favorites': 'view-favorites',
    'drones': 'view-drones',
    'batteries': 'view-batteries',
    'projects': 'view-projects',
    'wishlist': 'view-wishlist',
    'settings': 'view-settings'
  };

  const targetViewId = views[viewName];
  if (!targetViewId) return;

  currentView = viewName;

  // Toggle active view
  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(targetViewId).classList.add('active');

  // Toggle active tab bar button
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.classList.remove('active');
  });
  
  const activeTab = document.querySelector(`.tab-item[href="#${viewName}"]`);
  if (activeTab) activeTab.classList.add('active');

  // Close any details panel on navigation change
  closeDetailsPanel();

  // Dynamic header title
  const titles = {
    'home': 'Accueil Dashboard',
    'favorites': 'Favoris de Vol',
    'drones': 'Ma Flotte FPV',
    'batteries': 'Mes Batteries',
    'projects': 'Dossiers Projets',
    'wishlist': 'Liste de Souhaits',
    'settings': 'Réglages App'
  };
  document.getElementById('app-title').textContent = titles[viewName];

  // Hide Quick Add button on Home tab
  const btnAdd = document.getElementById('btn-add-quick');
  if (btnAdd) {
    btnAdd.style.display = viewName === 'home' ? 'none' : 'flex';
  }

  // Refresh current view content
  refreshCurrentView();
}

function refreshCurrentView() {
  if (currentView === 'home') refreshDashboardStats();
  else if (currentView === 'favorites') renderFavorites();
  else if (currentView === 'drones') renderDrones();
  else if (currentView === 'batteries') renderBatteries();
  else if (currentView === 'projects') renderProjects();
  else if (currentView === 'wishlist') renderWishlist();
}

function refreshAllViews() {
  refreshDashboardStats();
  renderDrones();
  renderBatteries();
  renderProjects();
  renderWishlist();
  renderFavorites();
}

/* ==========================================================================
   EVENT LISTENERS & EVENT DELEGATION
   ========================================================================== */
function setupEventListeners() {
  const modal = document.getElementById('modal-form');
  const btnAddQuick = document.getElementById('btn-add-quick');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnFormCancel = document.getElementById('btn-form-cancel');
  const appForm = document.getElementById('app-form');
  const btnPanelBack = document.getElementById('btn-panel-back');
  const btnPanelEdit = document.getElementById('btn-panel-edit');

  // Settings Actions
  document.getElementById('btn-clear-db').addEventListener('click', () => {
    if (confirm("ATTENTION : Voulez-vous vraiment vider toutes vos données ? Cette action est irréversible.")) {
      FPVDatabase.clearAll().then(() => {
        refreshAllViews();
        showToast("Toutes les données ont été effacées.", "info");
      });
    }
  });

  // DB Backup / Restore
  document.getElementById('btn-export').addEventListener('click', exportDatabase);
  document.getElementById('import-file').addEventListener('change', importDatabase);

  // Modal open (Add new entity)
  btnAddQuick.addEventListener('click', () => {
    const viewToEntity = {
      'drones': 'drone',
      'batteries': 'battery',
      'projects': 'project',
      'wishlist': 'wishlist',
      'settings': 'drone'
    };
    const entityType = viewToEntity[currentView] || 'drone';
    openFormModal(entityType);
  });

  // Modal close
  btnModalClose.addEventListener('click', () => modal.close());
  btnFormCancel.addEventListener('click', () => modal.close());

  // Form submit
  appForm.addEventListener('submit', handleFormSubmit);

  // Detail panel actions
  btnPanelBack.addEventListener('click', closeDetailsPanel);
  btnPanelEdit.addEventListener('click', () => {
    if (activeEntity) {
      const type = activeEntity.id.split('-')[0]; // Extract entity type 'drone'/'batt'/'proj'/'wish'
      const entityMap = { 'drone': 'drone', 'dron': 'drone', 'batt': 'battery', 'proj': 'project', 'wish': 'wishlist' };
      openFormModal(entityMap[type], activeEntity);
    }
  });
}

function setupSearchAndFilters() {
  // Drones
  document.getElementById('search-drones').addEventListener('input', renderDrones);
  document.getElementById('filter-drones-status').addEventListener('change', renderDrones);

  // Batteries
  document.getElementById('search-batteries').addEventListener('input', renderBatteries);
  document.getElementById('filter-batteries-cells').addEventListener('change', renderBatteries);

  // Projects
  document.getElementById('search-projects').addEventListener('input', renderProjects);

  // Wishlist
  document.getElementById('search-wishlist').addEventListener('input', renderWishlist);
  document.getElementById('filter-wishlist-priority').addEventListener('change', renderWishlist);
}

/* ==========================================================================
   TOAST SYSTEM (VIBRANT GLOW)
   ========================================================================== */
function showToast(message, type = 'info') {
  const toast = document.getElementById('notification-toast');
  toast.className = `toast toast-${type} show`;
  
  // Icon and text rendering
  const icons = {
    'success': '✓ ',
    'error': '⚠ ',
    'info': 'ℹ '
  };
  toast.textContent = (icons[type] || '') + message;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/* ==========================================================================
   DYNAMIC FORM SYSTEM (BUILDING FIELDS ON THE FLY)
   ========================================================================== */
function openFormModal(entityType, entityData = null) {
  const modal = document.getElementById('modal-form');
  const title = document.getElementById('modal-form-title');
  const typeInput = document.getElementById('form-entity-type');
  const idInput = document.getElementById('form-entity-id');
  const fieldsContainer = document.getElementById('dynamic-form-fields');

  // Set header & identifiers
  typeInput.value = entityType;
  idInput.value = entityData ? entityData.id : '';
  title.textContent = entityData 
    ? `Modifier ${entityType === 'drone' ? 'le Drone' : entityType === 'battery' ? 'la Batterie' : entityType === 'project' ? 'le Projet' : 'l\'Objet'}`
    : `Ajouter un ${entityType === 'drone' ? 'Drone' : entityType === 'battery' ? 'Batterie' : entityType === 'project' ? 'Projet' : 'Objet'}`;

  // Build appropriate form fields
  fieldsContainer.innerHTML = '';
  
  if (entityType === 'drone') {
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label for="f-name">Nom du Drone *</label>
        <input type="text" id="f-name" class="form-control" required value="${entityData?.name || ''}" placeholder="Ex: Apex 5'' Freestyle">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-status">Statut</label>
          <select id="f-status" class="form-control">
            <option value="Active" ${entityData?.status === 'Active' ? 'selected' : ''}>Actif</option>
            <option value="Repair" ${entityData?.status === 'Repair' ? 'selected' : ''}>En Réparation</option>
            <option value="Lost" ${entityData?.status === 'Lost' ? 'selected' : ''}>Perdu</option>
            <option value="Sold" ${entityData?.status === 'Sold' ? 'selected' : ''}>Vendu</option>
          </select>
        </div>
        <div class="form-group">
          <label for="f-cost">Coût total (€)</label>
          <input type="number" id="f-cost" class="form-control" value="${entityData?.cost || ''}" placeholder="Ex: 350">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-frame">Châssis (Frame)</label>
          <input type="text" id="f-frame" class="form-control" value="${entityData?.frame || ''}" placeholder="Ex: Apex 5''">
        </div>
        <div class="form-group">
          <label for="f-fc">Carte de vol (FC)</label>
          <input type="text" id="f-fc" class="form-control" value="${entityData?.fc || ''}" placeholder="Ex: Kakute H7">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-esc">ESC</label>
          <input type="text" id="f-esc" class="form-control" value="${entityData?.esc || ''}" placeholder="Ex: Tekko32 45A">
        </div>
        <div class="form-group">
          <label for="f-motors">Moteurs</label>
          <input type="text" id="f-motors" class="form-control" value="${entityData?.motors || ''}" placeholder="Ex: Xing2 2207">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-vtx">Module Vidéo (VTX)</label>
          <input type="text" id="f-vtx" class="form-control" value="${entityData?.vtx || ''}" placeholder="Ex: DJI O3 Air Unit">
        </div>
        <div class="form-group">
          <label for="f-camera">Caméra</label>
          <input type="text" id="f-camera" class="form-control" value="${entityData?.camera || ''}" placeholder="Ex: DJI O3 Camera">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-rx">Récepteur (RX)</label>
          <input type="text" id="f-rx" class="form-control" value="${entityData?.rx || ''}" placeholder="Ex: ELRS 2.4GHz">
        </div>
        <div class="form-group">
          <label for="f-firmware">Firmware / Version</label>
          <input type="text" id="f-firmware" class="form-control" value="${entityData?.firmware || ''}" placeholder="Ex: Betaflight 4.5.0">
        </div>
      </div>
      <div class="form-group">
        <label for="f-date">Date d'achat / premier vol</label>
        <input type="date" id="f-date" class="form-control" value="${entityData?.purchaseDate || ''}">
      </div>
      <div class="form-group">
        <label for="f-cli">Données Betaflight CLI Dump ou Diff</label>
        <textarea id="f-cli" class="form-control form-control-textarea textarea-cli" placeholder="Coller le dump ou le diff CLI de Betaflight ici pour analyser automatiquement votre setup...">${entityData?.betaflightConfig || ''}</textarea>
      </div>
      <div class="form-group">
        <label for="f-notes">Notes complémentaires</label>
        <textarea id="f-notes" class="form-control form-control-textarea" placeholder="Entrez vos réglages PID particuliers, hélices fétiches ou réparations...">${entityData?.notes || ''}</textarea>
      </div>
    `;
  } 
  
  else if (entityType === 'battery') {
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label for="f-name">Marque & Modèle *</label>
        <input type="text" id="f-name" class="form-control" required value="${entityData?.name || ''}" placeholder="Ex: Tattu R-Line v5">
      </div>
      <div class="form-group">
        <label for="f-barcode">Code-barres / QR (Optionnel)</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="f-barcode" class="form-control" value="${entityData?.barcode || ''}" placeholder="Saisir ou scanner...">
          <button type="button" id="btn-scan-form" class="btn-icon" style="background: rgba(124, 77, 255, 0.2); border: 1px solid var(--primary); color: var(--primary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M12 4v16M8 4v16M16 4v16"></path></svg></button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-type">Type</label>
          <select id="f-type" class="form-control">
            <option value="LiPo" ${entityData?.type === 'LiPo' ? 'selected' : ''}>LiPo</option>
            <option value="LiHV" ${entityData?.type === 'LiHV' ? 'selected' : ''}>LiHV (High Voltage)</option>
            <option value="LiIon" ${entityData?.type === 'LiIon' ? 'selected' : ''}>LiIon (Lithium-Ion)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="f-status">État</label>
          <select id="f-status" class="form-control">
            <option value="Storage" ${entityData?.status === 'Storage' ? 'selected' : ''}>Stockage (3.8V)</option>
            <option value="Charged" ${entityData?.status === 'Charged' ? 'selected' : ''}>Chargée (4.2V)</option>
            <option value="Discharged" ${entityData?.status === 'Discharged' ? 'selected' : ''}>Déchargée</option>
            <option value="Retired" ${entityData?.status === 'Retired' ? 'selected' : ''}>Hors Service (Sécurité)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-cells">Cellules (S) *</label>
          <input type="number" id="f-cells" class="form-control" required min="1" max="8" value="${entityData?.cells || 6}">
        </div>
        <div class="form-group">
          <label for="f-capacity">Capacité (mAh) *</label>
          <input type="number" id="f-capacity" class="form-control" required value="${entityData?.capacity || ''}" placeholder="Ex: 1300">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-cRating">Taux de décharge (C)</label>
          <input type="number" id="f-cRating" class="form-control" value="${entityData?.cRating || ''}" placeholder="Ex: 150">
        </div>
        <div class="form-group">
          <label for="f-cycles">Cycles de vol</label>
          <input type="number" id="f-cycles" class="form-control" value="${entityData?.cycles || 0}">
        </div>
      </div>
      <div class="form-group">
        <label for="f-ir">Résistances Internes (mΩ par cellule, séparées par des virgules)</label>
        <input type="text" id="f-ir" class="form-control" value="${entityData?.internalResistance ? entityData.internalResistance.join(', ') : ''}" placeholder="Ex: 8.2, 8.5, 8.1, 8.3, 8.4, 8.2">
      </div>
      <div class="form-group">
        <label for="f-date">Date d'achat</label>
        <input type="date" id="f-date" class="form-control" value="${entityData?.purchaseDate || ''}">
      </div>
      <div class="form-group">
        <label for="f-notes">Notes de santé de la batterie</label>
        <textarea id="f-notes" class="form-control form-control-textarea" placeholder="Indiquer si le pack chauffe, a subi un choc ou s'il s'agit d'une batterie d'entraînement...">${entityData?.notes || ''}</textarea>
      </div>
    `;
  }
  
  else if (entityType === 'project') {
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label for="f-name">Nom du Projet de Drone *</label>
        <input type="text" id="f-name" class="form-control" required value="${entityData?.name || ''}" placeholder="Ex: Montage Cinewhoop 3''">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-status">État du projet</label>
          <select id="f-status" class="form-control">
            <option value="Planning" ${entityData?.status === 'Planning' ? 'selected' : ''}>Planification / R&D</option>
            <option value="In Progress" ${entityData?.status === 'In Progress' ? 'selected' : ''}>En cours de montage</option>
            <option value="Testing" ${entityData?.status === 'Testing' ? 'selected' : ''}>Bancs de test / Tuning</option>
            <option value="Completed" ${entityData?.status === 'Completed' ? 'selected' : ''}>Terminé (Prêt au vol)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="f-budget">Budget estimatif (€)</label>
          <input type="number" id="f-budget" class="form-control" value="${entityData?.budget || ''}" placeholder="Ex: 500">
        </div>
      </div>
      <div class="form-group">
        <label for="f-desc">Description & Objectifs</label>
        <textarea id="f-desc" class="form-control form-control-textarea" placeholder="Expliquez à quoi servira ce drone, sa configuration ciblée ou son usage...">${entityData?.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label for="f-notes">Notes & Liens d'achats</label>
        <textarea id="f-notes" class="form-control form-control-textarea" placeholder="Entrez vos liens marchands, liste de visseries nécessaires ou modifications...">${entityData?.notes || ''}</textarea>
      </div>
    `;
  }
  
  else if (entityType === 'wishlist') {
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label for="f-name">Nom de l'article *</label>
        <input type="text" id="f-name" class="form-control" required value="${entityData?.name || ''}" placeholder="Ex: DJI Goggles 3">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-price">Prix estimatif (€) *</label>
          <input type="number" id="f-price" class="form-control" required step="0.01" value="${entityData?.price || ''}" placeholder="Ex: 659.00">
        </div>
        <div class="form-group">
          <label for="f-priority">Priorité d'achat</label>
          <select id="f-priority" class="form-control">
            <option value="High" ${entityData?.priority === 'High' ? 'selected' : ''}>Haute (Urgent / Indispensable)</option>
            <option value="Medium" ${entityData?.priority === 'Medium' ? 'selected' : ''}>Moyenne</option>
            <option value="Low" ${entityData?.priority === 'Low' ? 'selected' : ''}>Basse (Gadget / Secondaire)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="f-category">Catégorie</label>
          <select id="f-category" class="form-control">
            <option value="Drone" ${entityData?.category === 'Drone' ? 'selected' : ''}>Drone complet</option>
            <option value="Part" ${entityData?.category === 'Part' ? 'selected' : ''}>Composant / Pièce détachée</option>
            <option value="Battery" ${entityData?.category === 'Battery' ? 'selected' : ''}>Batterie</option>
            <option value="Gear" ${entityData?.category === 'Gear' ? 'selected' : ''}>Radiocommande / Lunettes / Outils</option>
          </select>
        </div>
        <div class="form-group">
          <label for="f-link">Lien marchand (URL)</label>
          <input type="url" id="f-link" class="form-control" value="${entityData?.link || ''}" placeholder="Ex: https://drone-fpv-shop.com/...">
        </div>
      </div>
      <div class="form-group">
        <label for="f-notes">Notes complémentaires</label>
        <textarea id="f-notes" class="form-control form-control-textarea" placeholder="Indiquer les codes promos, options ou détails de livraison...">${entityData?.notes || ''}</textarea>
      </div>
    `;
  }

  // Open HTML5 dialog modal natively
  modal.showModal();
}

/**
 * Handle addition or updates from form submission
 */
function handleFormSubmit(e) {
  e.preventDefault();

  const type = document.getElementById('form-entity-type').value;
  const existingId = document.getElementById('form-entity-id').value;
  const storeNameMap = {
    'drone': 'drones',
    'battery': 'batteries',
    'project': 'projects',
    'wishlist': 'wishlist'
  };
  const storeName = storeNameMap[type];

  // Generate ID if new
  const id = existingId || `${type.substring(0,4)}-${Date.now()}`;

  // Fetch current object if updating, or start fresh
  const fetchObject = existingId 
    ? FPVDatabase.get(storeName, existingId)
    : Promise.resolve({});

  fetchObject.then(originalObj => {
    let newItem = { ...originalObj, id };

    // Core inputs
    newItem.name = document.getElementById('f-name').value;
    
    if (type === 'drone') {
      newItem.status = document.getElementById('f-status').value;
      newItem.cost = parseFloat(document.getElementById('f-cost').value) || 0;
      newItem.frame = document.getElementById('f-frame').value;
      newItem.fc = document.getElementById('f-fc').value;
      newItem.esc = document.getElementById('f-esc').value;
      newItem.motors = document.getElementById('f-motors').value;
      newItem.vtx = document.getElementById('f-vtx').value;
      newItem.camera = document.getElementById('f-camera').value;
      newItem.rx = document.getElementById('f-rx').value;
      newItem.firmware = document.getElementById('f-firmware').value;
      newItem.purchaseDate = document.getElementById('f-date').value;
      newItem.notes = document.getElementById('f-notes').value;
      
      const newCli = document.getElementById('f-cli').value;
      newItem.betaflightConfig = newCli;

      // Extract details if CLI is populated and FC/Firmware was blank
      if (newCli) {
        const parsed = BetaflightParser.parse(newCli);
        if (parsed.boardName && !newItem.fc) newItem.fc = parsed.boardName;
        if (parsed.firmwareVersion && !newItem.firmware) newItem.firmware = (parsed.firmwareVersion.includes('Betaflight') ? '' : 'Betaflight ') + parsed.firmwareVersion;
        if (parsed.rxProvider && !newItem.rx) newItem.rx = parsed.rxProvider;
      }

      if (!newItem.invoices) newItem.invoices = [];
    } 
    
    else if (type === 'battery') {
      newItem.type = document.getElementById('f-type').value;
      newItem.status = document.getElementById('f-status').value;
      newItem.cells = parseInt(document.getElementById('f-cells').value, 10) || 1;
      newItem.capacity = parseInt(document.getElementById('f-capacity').value, 10) || 0;
      newItem.cRating = parseInt(document.getElementById('f-cRating').value, 10) || 0;
      newItem.cycles = parseInt(document.getElementById('f-cycles').value, 10) || 0;
      newItem.purchaseDate = document.getElementById('f-date').value;
      newItem.notes = document.getElementById('f-notes').value;
      newItem.barcode = document.getElementById('f-barcode') ? document.getElementById('f-barcode').value : '';

      const rawIr = document.getElementById('f-ir').value;
      if (rawIr) {
        newItem.internalResistance = rawIr.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
      } else {
        newItem.internalResistance = [];
      }
    } 
    
    else if (type === 'project') {
      newItem.status = document.getElementById('f-status').value;
      newItem.budget = parseFloat(document.getElementById('f-budget').value) || 0;
      newItem.description = document.getElementById('f-desc').value;
      newItem.notes = document.getElementById('f-notes').value;

      if (!newItem.components) newItem.components = [];
      if (!newItem.checklist) {
        newItem.checklist = [
          { text: 'Concevoir la configuration (Choix des pièces)', completed: true },
          { text: 'Commander et recevoir les composants', completed: false },
          { text: 'Préparer et souder les moteurs', completed: false },
          { text: 'Souder le récepteur et la liaison vidéo VTX', completed: false },
          { text: 'Configurer Betaflight CLI et ports UART', completed: false },
          { text: 'Faire le Maiden Flight (vol d\'essai)', completed: false }
        ];
      }
    } 
    
    else if (type === 'wishlist') {
      newItem.price = parseFloat(document.getElementById('f-price').value) || 0;
      newItem.priority = document.getElementById('f-priority').value;
      newItem.category = document.getElementById('f-category').value;
      newItem.link = document.getElementById('f-link').value;
      newItem.notes = document.getElementById('f-notes').value;
    }

    // Save in IndexedDB
    FPVDatabase.put(storeName, newItem)
      .then(() => {
        document.getElementById('modal-form').close();
        
        // If details panel is open with this entity, update it
        if (activeEntity && activeEntity.id === id) {
          activeEntity = newItem;
          renderEntityDetails(newItem);
        }

        refreshCurrentView();
        showToast("Enregistrement réussi !", "success");
      })
      .catch(err => {
        showToast("Erreur d'enregistrement : " + err.message, "error");
      });
  });
}

/* ==========================================================================
   DRONES SECTION (RENDER & ACTIONS)
   ========================================================================= */
function renderDrones() {
  const container = document.getElementById('drones-list-container');
  const searchVal = document.getElementById('search-drones').value.toLowerCase();
  const statusVal = document.getElementById('filter-drones-status').value;

  FPVDatabase.getAll('drones').then(drones => {
    // Filter
    const filtered = drones.filter(d => {
      const matchSearch = d.name.toLowerCase().includes(searchVal) || 
                            (d.frame && d.frame.toLowerCase().includes(searchVal)) ||
                            (d.fc && d.fc.toLowerCase().includes(searchVal));
      const matchStatus = statusVal === 'all' || d.status === statusVal;
      return matchSearch && matchStatus;
    });

    // Sort favorites first
    filtered.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

    // Update stats
    document.getElementById('stat-drones-total').textContent = drones.length;
    document.getElementById('stat-drones-active').textContent = drones.filter(d => d.status === 'Active').length;
    document.getElementById('stat-drones-repair').textContent = drones.filter(d => d.status === 'Repair').length;

    container.innerHTML = '';
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="info-card" style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
          <p class="text-muted">Aucun drone trouvé. Ajoutez votre premier quad FPV !</p>
        </div>
      `;
      return;
    }

    filtered.forEach(drone => {
      const card = createDroneCard(drone);
      container.appendChild(card);
    });
  });
}

/* ==========================================================================
   BATTERIES SECTION (RENDER, ACTIONS & MICRO-INCREMENTER)
   ========================================================================== */
function renderBatteries() {
  const container = document.getElementById('batteries-list-container');
  const searchVal = document.getElementById('search-batteries').value.toLowerCase();
  const cellsVal = document.getElementById('filter-batteries-cells').value;

  FPVDatabase.getAll('batteries').then(batteries => {
    // Filter
    const filtered = batteries.filter(b => {
      const matchSearch = b.name.toLowerCase().includes(searchVal) || b.type.toLowerCase().includes(searchVal);
      const matchCells = cellsVal === 'all' || `${b.cells}S` === cellsVal;
      return matchSearch && matchCells;
    });

    // Sort favorites first
    filtered.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

    // Update stats
    document.getElementById('stat-batt-total').textContent = batteries.length;
    document.getElementById('stat-batt-charged').textContent = batteries.filter(b => b.status === 'Charged').length;
    document.getElementById('stat-batt-storage').textContent = batteries.filter(b => b.status === 'Storage').length;

    container.innerHTML = '';
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="info-card" style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
          <p class="text-muted">Aucune batterie trouvée. Enregistrez vos Lipo/LiIon !</p>
        </div>
      `;
      return;
    }

    filtered.forEach(batt => {
      const card = createBatteryCard(batt);
      container.appendChild(card);
    });
  });
}

function saveBatteryCycles(battery, uiTextElement) {
  // UI immediate update with a tiny scale bounce animation
  uiTextElement.textContent = `${battery.cycles} cycles`;
  uiTextElement.style.transform = 'scale(1.2)';
  uiTextElement.style.color = 'var(--cyan)';
  setTimeout(() => {
    uiTextElement.style.transform = 'none';
    uiTextElement.style.color = 'inherit';
  }, 180);

  FPVDatabase.put('batteries', battery)
    .then(() => {
      showToast(`Cycles de ${battery.name} mis à jour (${battery.cycles})`, "success");
      // Keep battery stats updated in background
    });
}

/* ==========================================================================
   PROJECTS SECTION (RENDER, CHECKLISTS & BUDGETS)
   ========================================================================== */
function renderProjects() {
  const container = document.getElementById('projects-list-container');
  const searchVal = document.getElementById('search-projects').value.toLowerCase();

  FPVDatabase.getAll('projects').then(projects => {
    const filtered = projects.filter(p => p.name.toLowerCase().includes(searchVal) || p.description.toLowerCase().includes(searchVal));

    // Sort favorites first
    filtered.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

    document.getElementById('stat-proj-total').textContent = projects.length;
    document.getElementById('stat-proj-ongoing').textContent = projects.filter(p => p.status !== 'Completed').length;
    document.getElementById('stat-proj-done').textContent = projects.filter(p => p.status === 'Completed').length;

    container.innerHTML = '';
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="info-card" style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
          <p class="text-muted">Aucun projet en cours. Créez votre prochain build !</p>
        </div>
      `;
      return;
    }

    filtered.forEach(proj => {
      const card = createProjectCard(proj);
      container.appendChild(card);
    });
  });
}

/* ==========================================================================
   WISHLIST SECTION (RENDER & CONVERSIONS)
   ========================================================================== */
function renderWishlist() {
  const container = document.getElementById('wishlist-container');
  const searchVal = document.getElementById('search-wishlist').value.toLowerCase();
  const priorityVal = document.getElementById('filter-wishlist-priority').value;

  FPVDatabase.getAll('wishlist').then(wishlist => {
    const filtered = wishlist.filter(w => {
      const matchSearch = w.name.toLowerCase().includes(searchVal) || (w.notes && w.notes.toLowerCase().includes(searchVal));
      const matchPriority = priorityVal === 'all' || w.priority === priorityVal;
      return matchSearch && matchPriority;
    });

    // Sort favorites first
    filtered.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

    const totalCost = filtered.reduce((sum, item) => sum + item.price, 0);

    document.getElementById('stat-wish-total').textContent = wishlist.length;
    document.getElementById('stat-wish-high').textContent = wishlist.filter(w => w.priority === 'High').length;
    document.getElementById('stat-wish-cost').textContent = `${Math.round(totalCost)}€`;

    container.innerHTML = '';
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="info-card" style="text-align: center; padding: 40px 20px;">
          <p class="text-muted">Aucun objet dans votre liste de souhaits. Remplissez-la !</p>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const elem = createWishlistCard(item);
      container.appendChild(elem);
    });
  });
}

/**
 * Super neat conversion tool to convert a wishlist item into either a fleet drone
 * or a component of an ongoing project.
 */
function convertWishlistItem(item) {
  // Let the user choose what to convert this purchased item into
  const choice = prompt(
    `Vous avez acheté "${item.name}" ! Que voulez-vous faire ?\n\n` +
    `Tapez 'D' pour l'ajouter directement comme Drone actif dans votre flotte.\n` +
    `Tapez 'P' pour l'ajouter comme composant "Reçu" dans un de vos projets.\n` +
    `Appuyez sur Annuler pour ne rien faire.`
  );

  if (!choice) return;
  const command = choice.trim().toUpperCase();

  if (command === 'D') {
    // Convert to Active Drone
    const newDrone = {
      id: `dron-${Date.now()}`,
      name: item.name,
      status: 'Active',
      cost: item.price,
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: `Acheté depuis la wishlist. Notes d'origine : ${item.notes || 'aucune.'}`,
      invoices: [],
      betaflightConfig: ''
    };

    Promise.all([
      FPVDatabase.add('drones', newDrone),
      FPVDatabase.delete('wishlist', item.id)
    ]).then(() => {
      refreshAllViews();
      showToast(`"${item.name}" a été ajouté à votre flotte de drones !`, "success");
    });
  } 
  
  else if (command === 'P') {
    // Convert to Project Component
    FPVDatabase.getAll('projects').then(projects => {
      if (projects.length === 0) {
        showToast("Aucun projet en cours pour insérer ce composant.", "error");
        return;
      }

      // Render a simple prompt to choose project
      let promptText = "Dans quel projet ajouter ce composant ? Saisissez le numéro :\n\n";
      projects.forEach((p, idx) => {
        promptText += `${idx + 1}. ${p.name}\n`;
      });

      const projChoice = prompt(promptText);
      const projIdx = parseInt(projChoice, 10) - 1;

      if (isNaN(projIdx) || projIdx < 0 || projIdx >= projects.length) {
        showToast("Choix du projet invalide.", "error");
        return;
      }

      const selectedProj = projects[projIdx];
      
      // Push component
      selectedProj.components.push({
        name: item.name,
        price: item.price,
        status: 'Arrived' // Set as received directly
      });

      // Toggle first pending checklist task that corresponds to ordering parts
      const receivePartsTask = selectedProj.checklist.find(t => t.text.toLowerCase().includes('commander') || t.text.toLowerCase().includes('composant'));
      if (receivePartsTask) receivePartsTask.completed = true;

      Promise.all([
        FPVDatabase.put('projects', selectedProj),
        FPVDatabase.delete('wishlist', item.id)
      ]).then(() => {
        refreshAllViews();
        showToast(`Composant inséré avec succès dans le projet "${selectedProj.name}" !`, "success");
      });
    });
  } 
  
  else {
    showToast("Option non reconnue.", "info");
  }
}

/* ==========================================================================
   DETAILS PANEL INSPECTOR (SLIDE-IN DRAWERS)
   ========================================================================== */
function openDetailsPanel(entity) {
  activeEntity = entity;
  const panel = document.getElementById('panel-details');
  const title = document.getElementById('panel-details-title');
  
  title.textContent = entity.name;
  renderEntityDetails(entity);
  
  panel.classList.add('open');
}

function closeDetailsPanel() {
  document.getElementById('panel-details').classList.remove('open');
  activeEntity = null;
}

function renderEntityDetails(entity) {
  const container = document.getElementById('panel-details-body');
  const entityType = entity.id.split('-')[0];

  container.innerHTML = '';

  // 1. DRONE DETAILS
  if (entityType === 'drone' || entityType === 'dron') {
    // Parse Betaflight config
    const parsedCli = BetaflightParser.parse(entity.betaflightConfig);
    const parsedCliHTML = BetaflightParser.renderHTML(parsedCli);

    // Dynamic invoices list
    let invoicesHTML = '';
    if (entity.invoices && entity.invoices.length > 0) {
      invoicesHTML = entity.invoices.map(inv => `
        <div class="invoice-card" id="inv-card-${inv.id}">
          <div class="invoice-info">
            <h4>${inv.name}</h4>
            <p>Le ${inv.date} • ${inv.amount}€</p>
          </div>
          <div class="invoice-actions">
            <button class="btn-small-view" onclick="previewInvoice('${inv.id}')">Voir</button>
            <button class="btn-small-danger" onclick="deleteInvoice('${inv.id}')">Suppr.</button>
          </div>
        </div>
      `).join('');
    } else {
      invoicesHTML = '<p class="text-muted" style="font-size: 0.85rem;">Aucun reçu ou facture stocké.</p>';
    }

    container.innerHTML = `
      <div class="detail-banner">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h4 style="font-size: 1.3rem; font-weight: 700; color: #fff; margin: 0;">${entity.name}</h4>
            <button class="btn-favorite-star ${entity.favorite ? 'is-favorite' : ''}" onclick="toggleDetailFavorite('${entity.id}')" style="font-size: 1.4rem;">★</button>
          </div>
          <span class="badge badge-${entity.status.toLowerCase()}">${entity.status === 'Active' ? 'Actif' : 'En panne'}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: -4px;">Châssis : ${entity.frame || 'Non précisé'}</p>
      </div>

      <div class="detail-section-title">Spécifications Matérielles</div>
      <div class="specs-grid">
        <div class="spec-box">
          <div class="spec-box-label">Contrôleur de Vol</div>
          <div class="spec-box-value">${entity.fc || 'Inconnu'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">ESC (Variateur)</div>
          <div class="spec-box-value">${entity.esc || 'Inconnu'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Module Vidéo (VTX)</div>
          <div class="spec-box-value">${entity.vtx || 'Inconnu'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Caméra FPV</div>
          <div class="spec-box-value">${entity.camera || 'Inconnue'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Moteurs</div>
          <div class="spec-box-value">${entity.motors || 'Inconnus'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Récepteur RC</div>
          <div class="spec-box-value">${entity.rx || 'Inconnu'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Firmware</div>
          <div class="spec-box-value">${entity.firmware || 'Inconnu'}</div>
        </div>
      </div>

      <div class="detail-section-title">Données & Coûts</div>
      <div class="specs-grid">
        <div class="spec-box">
          <div class="spec-box-label">Investissement Total</div>
          <div class="spec-box-value" style="color: var(--cyan);">${entity.cost || 0} €</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Date d'acquisition</div>
          <div class="spec-box-value">${entity.purchaseDate || 'Non spécifiée'}</div>
        </div>
      </div>

      <div style="margin-top: 15px; background: rgba(255,255,255,0.02); border: 1px solid var(--surface-border); border-radius: 12px; padding: 14px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Notes de vol / Entretien</div>
        <p style="font-size: 0.9rem; line-height: 1.4; color: #fff;">${entity.notes || 'Aucune note complémentaire.'}</p>
      </div>

      <div id="betaflight-cli-analysis-section">
        ${parsedCliHTML}
      </div>

      <!-- INVOICE SECTION (Base64 offline storage) -->
      <div class="detail-section-title">Factures & Justificatifs</div>
      
      <div class="invoice-upload-zone" id="invoice-upload-dropzone">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--cyan); margin-bottom: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
        <p style="font-size: 0.85rem; font-weight: 600;">Téléverser ou prendre en photo une facture</p>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Image enregistrée hors-ligne dans la DB</p>
        <input type="file" id="invoice-file-input" accept="image/*" style="display: none;">
      </div>

      <div class="invoices-gallery" style="margin-top: 14px;">
        ${invoicesHTML}
      </div>

      <div style="margin-top: 30px;">
        <button class="btn btn-danger" onclick="deleteEntity('drones', '${entity.id}')">Supprimer ce drone définitivement</button>
      </div>
    `;

    // Dropzone setup
    const dropzone = document.getElementById('invoice-upload-dropzone');
    const fileInput = document.getElementById('invoice-file-input');
    
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleInvoiceUpload);
  } 
  
  // 2. BATTERY DETAILS
  else if (entityType === 'batt') {
    // Generate internal resistance per cell blocks
    let cellsIrHTML = '';
    if (entity.internalResistance && entity.internalResistance.length > 0) {
      cellsIrHTML = entity.internalResistance.map((ir, i) => {
        // Color matching based on resistance state (FPV standard: <10mOhm = perfect, <15mOhm = good, >20mOhm = degraded)
        let irColor = 'green';
        if (ir > 20) irColor = 'red';
        else if (ir > 13) irColor = 'orange';

        return `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--surface-border); border-radius: 12px; padding: 10px; text-align: center; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: bold;">Cellule ${i + 1}</span>
            <span class="text-${irColor}" style="font-size: 1.15rem; font-weight: 800; font-family: var(--font-mono);">${ir}</span>
            <span style="font-size: 0.65rem; color: var(--text-muted);">mΩ</span>
          </div>
        `;
      }).join('');
    } else {
      cellsIrHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; font-size: 0.85rem; padding: 10px;">Aucune mesure de résistance interne enregistrée.</p>';
    }

    container.innerHTML = `
      <div class="detail-banner" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%); border-color: rgba(16, 185, 129, 0.3);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h4 style="font-size: 1.3rem; font-weight: 700; color: #fff; margin: 0;">${entity.name}</h4>
            <button class="btn-favorite-star ${entity.favorite ? 'is-favorite' : ''}" onclick="toggleDetailFavorite('${entity.id}')" style="font-size: 1.4rem;">★</button>
          </div>
          <span class="badge badge-${entity.status.toLowerCase()}">${entity.status}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: -4px;">Format : ${entity.cells}S - ${entity.capacity}mAh (${entity.type})</p>
      </div>

      <div class="detail-section-title">Informations de Charge</div>
      <div class="specs-grid">
        <div class="spec-box">
          <div class="spec-box-label">Cycles effectués</div>
          <div class="spec-box-value" style="color: var(--cyan);">${entity.cycles} vols</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Taux de décharge</div>
          <div class="spec-box-value">${entity.cRating ? entity.cRating + ' C' : 'N/A'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Tension nominale</div>
          <div class="spec-box-value" style="font-family: var(--font-mono);">${(entity.cells * 3.7).toFixed(1)} V</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Achetée le</div>
          <div class="spec-box-value">${entity.purchaseDate || 'Non spécifiée'}</div>
        </div>
      </div>

      <div class="detail-section-title">Résistances Internes (Santé du Pack)</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px;">
        ${cellsIrHTML}
      </div>

      <div style="margin-top: 16px; background: rgba(255,255,255,0.02); border: 1px solid var(--surface-border); border-radius: 12px; padding: 14px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Carnet de santé / Notes</div>
        <p style="font-size: 0.9rem; line-height: 1.4; color: #fff;">${entity.notes || 'Aucune observation enregistrée.'}</p>
      </div>

      <div style="margin-top: 30px;">
        <button class="btn btn-danger" onclick="deleteEntity('batteries', '${entity.id}')">Supprimer cette batterie définitivement</button>
      </div>
    `;
  } 
  
  // 3. PROJECT DETAILS
  else if (entityType === 'proj') {
    // Budget Calculations
    const spent = entity.components.reduce((sum, c) => sum + (c.status === 'Arrived' || c.status === 'Ordered' ? c.price : 0), 0);
    const left = entity.budget - spent;

    // Component Lines
    let compsHTML = '';
    if (entity.components && entity.components.length > 0) {
      compsHTML = entity.components.map((c, i) => `
        <div class="spec-line" style="background: rgba(255,255,255,0.01); padding: 10px; border-radius: 8px; border: 1px solid var(--surface-border); align-items: center;">
          <div style="display: flex; flex-direction: column; gap: 2px; max-width: 60%;">
            <span style="font-weight: 600; color: #fff; font-size: 0.85rem;">${c.name}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${c.price}€</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="component-status-badge comp-${c.status}" onclick="cycleComponentStatus(${i})">${c.status === 'Needed' ? 'À commander' : c.status === 'Ordered' ? 'Commandé' : 'Reçu'}</span>
            <button style="background: none; border: none; color: var(--red); font-size: 1.1rem; cursor: pointer; padding: 4px;" onclick="deleteComponent(${i})">&times;</button>
          </div>
        </div>
      `).join('');
    } else {
      compsHTML = '<p class="text-muted" style="font-size: 0.85rem; padding: 10px;">Aucun composant listé.</p>';
    }

    // Checklist Lines
    let checklistHTML = '';
    if (entity.checklist && entity.checklist.length > 0) {
      checklistHTML = entity.checklist.map((t, i) => `
        <div class="project-checklist-item">
          <div class="project-checklist-checkbox ${t.completed ? 'completed' : ''}" onclick="toggleChecklistTask(${i})"></div>
          <span class="project-checklist-text ${t.completed ? 'completed' : ''}">${t.text}</span>
          <button style="background: none; border: none; color: var(--text-muted); margin-left: auto; font-size: 1rem; cursor: pointer;" onclick="deleteChecklistTask(${i})">&times;</button>
        </div>
      `).join('');
    } else {
      checklistHTML = '<p class="text-muted" style="font-size: 0.85rem; padding: 10px;">Aucune tâche.</p>';
    }

    container.innerHTML = `
      <div class="detail-banner" style="background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(236, 72, 153, 0.05) 100%); border-color: rgba(249, 115, 22, 0.3);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h4 style="font-size: 1.3rem; font-weight: 700; color: #fff; margin: 0;">${entity.name}</h4>
            <button class="btn-favorite-star ${entity.favorite ? 'is-favorite' : ''}" onclick="toggleDetailFavorite('${entity.id}')" style="font-size: 1.4rem;">★</button>
          </div>
          <span class="badge" style="background: rgba(249, 115, 22, 0.15); color: var(--orange); border: 1px solid rgba(249, 115, 22, 0.3);">${entity.status}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: -4px;">${entity.description || 'Pas de description.'}</p>
      </div>

      <!-- Financial overview -->
      <div class="specs-grid">
        <div class="spec-box">
          <div class="spec-box-label">Budget Global Cible</div>
          <div class="spec-box-value">${entity.budget} €</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Total Dépensé / Commandé</div>
          <div class="spec-box-value" style="color: var(--secondary);">${spent} €</div>
        </div>
        <div class="spec-box" style="grid-column: 1/-1;">
          <div class="spec-box-label">Reste en caisse</div>
          <div class="spec-box-value ${left < 0 ? 'text-red' : 'text-green'}">${left} €</div>
        </div>
      </div>

      <!-- COMPONENTS -->
      <div class="detail-section-title">Composants Nécessaires</div>
      
      <!-- Component quick adder -->
      <div style="display: flex; gap: 8px; margin-bottom: 10px;">
        <input type="text" id="add-comp-name" class="search-input" placeholder="Composant... (Ex: Caméra)" style="flex: 2;">
        <input type="number" id="add-comp-price" class="search-input" placeholder="Prix (€)" style="flex: 1;">
        <button class="btn btn-primary" style="width: auto; padding: 10px 14px;" onclick="addQuickComponent()">+</button>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
        ${compsHTML}
      </div>

      <!-- CHECKLIST -->
      <div class="detail-section-title">Checklist d'assemblage</div>
      
      <!-- Checklist quick adder -->
      <div style="display: flex; gap: 8px; margin-bottom: 10px;">
        <input type="text" id="add-task-text" class="search-input" placeholder="Nouvelle étape... (Ex: Flash ELRS)">
        <button class="btn btn-primary" style="width: auto; padding: 10px 14px;" onclick="addQuickChecklistTask()">+</button>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
        ${checklistHTML}
      </div>

      <div style="margin-top: 30px;">
        <button class="btn btn-danger" onclick="deleteEntity('projects', '${entity.id}')">Supprimer ce projet définitivement</button>
      </div>
    `;
  }
}

/* ==========================================================================
   INVOICE DOCUMENT MANAGER (OFFLINE BASE64 PHOTO UPLOAD)
   ========================================================================== */
function handleInvoiceUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate format
  if (!file.type.startsWith('image/')) {
    showToast("Seuls les formats images sont supportés (JPG, PNG, WebP) pour l'aperçu.", "error");
    return;
  }

  // Large files check: warn user about size
  const maxMb = 2;
  if (file.size > maxMb * 1024 * 1024) {
    showToast("Image trop lourde. Privilégiez une image sous 2Mo pour le stockage hors-ligne.", "error");
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64Data = event.target.result;
    
    // Prompt invoice details
    const name = prompt("Entrez le libellé de la facture :", `Achat ${activeEntity.name}`);
    if (name === null) return; // user cancelled

    const amountInput = prompt("Entrez le montant en Euros (€) :", "45");
    const amount = parseFloat(amountInput) || 0;

    const date = new Date().toISOString().split('T')[0];

    const invoiceObj = {
      id: `inv-${Date.now()}`,
      name: name || 'Reçu de commande',
      date,
      amount,
      fileData: base64Data
    };

    // Push into active drone's invoices array
    if (!activeEntity.invoices) activeEntity.invoices = [];
    activeEntity.invoices.push(invoiceObj);

    // Recalculate cost
    const totalCost = activeEntity.invoices.reduce((sum, inv) => sum + inv.amount, 0);
    if (totalCost > 0) activeEntity.cost = totalCost;

    // Save in IndexedDB
    FPVDatabase.put('drones', activeEntity)
      .then(() => {
        renderEntityDetails(activeEntity);
        refreshCurrentView();
        showToast("Facture importée avec succès hors-ligne !", "success");
      })
      .catch(err => {
        showToast("Erreur d'import de facture : " + err.message, "error");
      });
  };

  reader.readAsDataURL(file);
}

// Global scope window methods for inline onclick event binding
window.previewInvoice = function(invoiceId) {
  if (!activeEntity || !activeEntity.invoices) return;
  const invoice = activeEntity.invoices.find(inv => inv.id === invoiceId);
  if (!invoice) return;

  // Create or retrieve full lightbox modal
  let previewModal = document.getElementById('invoice-preview-modal');
  if (!previewModal) {
    previewModal = document.createElement('div');
    previewModal.id = 'invoice-preview-modal';
    previewModal.className = 'invoice-preview-modal';
    previewModal.innerHTML = `
      <div class="invoice-preview-content">
        <button class="invoice-preview-close" id="invoice-preview-close">&times;</button>
        <img class="invoice-preview-image" id="invoice-preview-image" src="" alt="Aperçu Facture">
      </div>
    `;
    document.body.appendChild(previewModal);
    
    // Bind click closing
    document.getElementById('invoice-preview-close').addEventListener('click', () => {
      previewModal.classList.remove('active');
    });
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) previewModal.classList.remove('active');
    });
  }

  const img = document.getElementById('invoice-preview-image');
  img.src = invoice.fileData;
  previewModal.classList.add('active');
};

function setupInvoicePreviewClose() {
  // Setup if already exists in DOM
  const closeBtn = document.getElementById('invoice-preview-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('invoice-preview-modal').classList.remove('active');
    });
  }
}

window.deleteInvoice = function(invoiceId) {
  if (!activeEntity || !activeEntity.invoices) return;
  if (!confirm("Voulez-vous supprimer cette facture ?")) return;

  activeEntity.invoices = activeEntity.invoices.filter(inv => inv.id !== invoiceId);

  // Recalculate cost
  const totalCost = activeEntity.invoices.reduce((sum, inv) => sum + inv.amount, 0);
  activeEntity.cost = totalCost || activeEntity.cost;

  FPVDatabase.put('drones', activeEntity).then(() => {
    renderEntityDetails(activeEntity);
    refreshCurrentView();
    showToast("Facture supprimée.", "info");
  });
};

/* ==========================================================================
   PROJECT DETAILS MUTATORS (COMPONENTS / CHECKLISTS DYNAMIC UPDATES)
   ========================================================================== */
window.addQuickComponent = function() {
  const nameInput = document.getElementById('add-comp-name');
  const priceInput = document.getElementById('add-comp-price');
  
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value) || 0;

  if (!name) {
    showToast("Veuillez entrer le nom du composant.", "error");
    return;
  }

  activeEntity.components.push({
    name,
    price,
    status: 'Needed'
  });

  FPVDatabase.put('projects', activeEntity).then(() => {
    renderEntityDetails(activeEntity);
    refreshCurrentView();
    showToast("Composant ajouté !", "success");
  });
};

window.deleteComponent = function(index) {
  activeEntity.components.splice(index, 1);
  FPVDatabase.put('projects', activeEntity).then(() => {
    renderEntityDetails(activeEntity);
    refreshCurrentView();
    showToast("Composant supprimé.", "info");
  });
};

window.cycleComponentStatus = function(index) {
  const comp = activeEntity.components[index];
  const nextStatus = { 'Needed': 'Ordered', 'Ordered': 'Arrived', 'Arrived': 'Needed' };
  
  comp.status = nextStatus[comp.status] || 'Needed';

  // Toggle order task in checklists automatically
  if (comp.status === 'Ordered') {
    showToast(`Composant "${comp.name}" marqué comme COMMANDÉ.`, "info");
  } else if (comp.status === 'Arrived') {
    showToast(`Composant "${comp.name}" marqué comme REÇU !`, "success");
  }

  FPVDatabase.put('projects', activeEntity).then(() => {
    renderEntityDetails(activeEntity);
    refreshCurrentView();
  });
};

window.addQuickChecklistTask = function() {
  const textInput = document.getElementById('add-task-text');
  const text = textInput.value.trim();

  if (!text) {
    showToast("Veuillez entrer le texte de la tâche.", "error");
    return;
  }

  activeEntity.checklist.push({
    text,
    completed: false
  });

  FPVDatabase.put('projects', activeEntity).then(() => {
    renderEntityDetails(activeEntity);
    refreshCurrentView();
    showToast("Étape de checklist ajoutée !", "success");
  });
};

window.deleteChecklistTask = function(index) {
  activeEntity.checklist.splice(index, 1);
  FPVDatabase.put('projects', activeEntity).then(() => {
    renderEntityDetails(activeEntity);
    refreshCurrentView();
    showToast("Étape supprimée.", "info");
  });
};

window.toggleChecklistTask = function(index) {
  const task = activeEntity.checklist[index];
  task.completed = !task.completed;

  FPVDatabase.put('projects', activeEntity).then(() => {
    renderEntityDetails(activeEntity);
    refreshCurrentView();
    
    if (task.completed) {
      showToast("Étape complétée ! ✓", "success");
    }
  });
};

/* ==========================================================================
   GLOBAL DETAIL PANEL FAVORITE TOGGLE
   ========================================================================== */
window.toggleDetailFavorite = function(id) {
  const storeNameMap = {
    'dron': 'drones',
    'drone': 'drones',
    'batt': 'batteries',
    'proj': 'projects',
    'wish': 'wishlist'
  };
  const prefix = id.split('-')[0];
  const storeName = storeNameMap[prefix];
  if (!storeName) return;

  FPVDatabase.get(storeName, id).then(entity => {
    entity.favorite = !entity.favorite;
    FPVDatabase.put(storeName, entity).then(() => {
      // Re-render the details panel to update star state
      renderEntityDetails(entity);
      // Refresh the background lists
      refreshCurrentView();
      showToast(entity.favorite ? "Ajouté aux favoris ⭐" : "Retiré des favoris", "success");
    });
  });
};

/* ==========================================================================
   GLOBAL ENTITY DELETION
   ========================================================================== */
window.deleteEntity = function(storeName, id) {
  if (!confirm("Voulez-vous vraiment supprimer cet élément définitivement ?")) return;

  FPVDatabase.delete(storeName, id)
    .then(() => {
      closeDetailsPanel();
      refreshCurrentView();
      showToast("Élément supprimé avec succès.", "info");
    })
    .catch(err => {
      showToast("Erreur lors de la suppression : " + err.message, "error");
    });
};

/* ==========================================================================
   DATABASE BACKUPS (IMPORT & EXPORT EN JSON)
   ========================================================================== */
function exportDatabase() {
  Promise.all([
    FPVDatabase.getAll('drones'),
    FPVDatabase.getAll('batteries'),
    FPVDatabase.getAll('projects'),
    FPVDatabase.getAll('wishlist')
  ]).then(([drones, batteries, projects, wishlist]) => {
    const backup = {
      exportedAt: new Date().toISOString(),
      drones,
      batteries,
      projects,
      wishlist
    };

    // Create a blob instead of data URI for reliability with large datasets (invoices base64) on Safari/iOS
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.href = url;
    downloadAnchor.download = `fpv_manager_backup_${dateStr}.json`;
    document.body.appendChild(downloadAnchor);
    
    downloadAnchor.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
    }, 100);

    showToast("Base de données exportée avec succès !", "success");
  }).catch(err => {
    showToast("Échec d'exportation : " + err.message, "error");
  });
}

function importDatabase(e) {
  const file = e.target.files[0];
  const statusMsg = document.getElementById('import-status');
  if (!file) return;

  statusMsg.style.display = 'block';
  statusMsg.className = 'import-status-msg';
  statusMsg.textContent = 'Analyse du fichier de sauvegarde...';

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      
      // Simple validation
      if (!parsed.drones || !parsed.batteries || !parsed.projects || !parsed.wishlist) {
        throw new Error("Le fichier JSON ne respecte pas le format de sauvegarde FPV Manager.");
      }

      statusMsg.textContent = 'Restauration de la base IndexedDB...';

      // Clear existing DB and restore stores sequentially
      FPVDatabase.clearAll()
        .then(() => {
          const promises = [];
          
          parsed.drones.forEach(d => promises.push(FPVDatabase.put('drones', d)));
          parsed.batteries.forEach(b => promises.push(FPVDatabase.put('batteries', b)));
          parsed.projects.forEach(p => promises.push(FPVDatabase.put('projects', p)));
          parsed.wishlist.forEach(w => promises.push(FPVDatabase.put('wishlist', w)));

          return Promise.all(promises);
        })
        .then(() => {
          statusMsg.className = 'import-status-msg import-success';
          statusMsg.textContent = `Restauration réussie ! ${parsed.drones.length} drones, ${parsed.batteries.length} batteries importés.`;
          refreshAllViews();
          showToast("Données restaurées !", "success");
          
          // Clear input
          e.target.value = '';
          
          // Hide message after 5 seconds
          setTimeout(() => { statusMsg.style.display = 'none'; }, 5000);
        })
        .catch(dbErr => {
          throw new Error("Erreur d'écriture DB : " + dbErr.message);
        });

    } catch (err) {
      statusMsg.className = 'import-status-msg import-error';
      statusMsg.textContent = "Erreur d'importation : " + err.message;
      showToast("Échec d'importation.", "error");
      e.target.value = '';
    }
  };

  reader.readAsText(file);
}

/* ==========================================================================
   DASHBOARD / HOME STATS
   ========================================================================== */
function refreshDashboardStats() {
  FPVDatabase.getAll('drones').then(drones => {
    const active = drones.filter(d => d.status === 'Active').length;
    document.getElementById('dash-stat-drones').textContent = `${drones.length} Drones (${active} Actifs)`;
  });
  FPVDatabase.getAll('batteries').then(batts => {
    document.getElementById('dash-stat-batt').textContent = `${batts.length} LiPos/LiIons`;
  });
  FPVDatabase.getAll('projects').then(projs => {
    const ongoing = projs.filter(p => p.status !== 'Completed').length;
    document.getElementById('dash-stat-proj').textContent = `${ongoing} En cours`;
  });
  FPVDatabase.getAll('wishlist').then(wish => {
    document.getElementById('dash-stat-wish').textContent = `${wish.length} Pièces`;
  });
}

/* ==========================================================================
   BARCODE & QR CODE SCANNER INTEGRATION (ZXING LIBRARY)
   ========================================================================== */
let zxingReader = null;
let zxingControls = null;
let scannerStream = null; // Track global du flux pour nettoyage facile
let currentScannerTarget = null; // 'list' or 'form'
let isScannerProcessing = false;

function setupScanner() {
  const btnScanBatteries = document.getElementById('btn-scan-batteries');
  const btnScannerClose = document.getElementById('btn-scanner-close');
  const btnScannerFile = document.getElementById('btn-scanner-file');
  const scannerFileInput = document.getElementById('scanner-file-input');

  if (btnScanBatteries) {
    btnScanBatteries.addEventListener('click', () => {
      openScanner('list');
    });
  }

  // Event delegation for the dynamic form scanner button
  document.addEventListener('click', (e) => {
    const btnScanForm = e.target.closest('#btn-scan-form');
    if (btnScanForm) {
      openScanner('form');
    }
  });

  if (btnScannerClose) {
    btnScannerClose.addEventListener('click', closeScanner);
  }

  if (btnScannerFile && scannerFileInput) {
    btnScannerFile.addEventListener('click', () => {
      scannerFileInput.click();
    });

    scannerFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (typeof ZXing === 'undefined') {
        showToast("La bibliothèque de scan charge...", "info");
        return;
      }

      if (!zxingReader) {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.QR_CODE
        ]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        zxingReader = new ZXing.BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 100
        });
      }

      showToast("Analyse de l'image...", "info");

      // Stop video stream first if scanning
      stopZxingCamera();

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          zxingReader.decodeFromImageElement(img)
            .then(result => {
              onScanSuccess(result.getText());
            })
            .catch(err => {
              console.error("ZXing Image decoding error:", err);
              showToast("Aucun code détecté sur cette photo. Ajustez la netteté et réessayez.", "error");
            });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);

      // Clear selection so the same image can be re-selected if needed
      scannerFileInput.value = "";
    });
  }
}

async function openScanner(target) {
  currentScannerTarget = target;
  isScannerProcessing = false;
  
  const modalScanner = document.getElementById('scanner-modal');
  modalScanner.showModal();

  if (typeof ZXing === 'undefined') {
    showToast("La bibliothèque de scan charge...", "info");
    setTimeout(() => openScanner(target), 500);
    return;
  }

  if (!zxingReader) {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.QR_CODE
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    
    zxingReader = new ZXing.BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 100
    });
  }

  const videoElement = document.getElementById('preview-video');
  if (!videoElement) {
    console.error("Video element not found");
    return;
  }

  // Configuration stricte pour l'autoplay iOS Safari
  videoElement.setAttribute('autoplay', 'true');
  videoElement.setAttribute('muted', 'true');
  videoElement.setAttribute('playsinline', 'true');

  showToast("Démarrage de la caméra...", "info");

  // Acquisition manuelle du flux en mode dégradé progressif (paliers) pour iOS
  let stream = null;
  const constraintTiers = [
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 }
      }
    },
    {
      video: {
        facingMode: { ideal: 'environment' }
      }
    },
    {
      video: true
    }
  ];

  let lastError = null;
  for (const constraints of constraintTiers) {
    try {
      console.log("Tentative getUserMedia avec:", constraints);
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream) break; // Succès
    } catch (err) {
      console.warn("Échec getUserMedia pour ce palier:", constraints, err);
      lastError = err;
    }
  }

  if (!stream) {
    console.error("Tous les paliers getUserMedia ont échoué:", lastError);
    showToast(`Caméra bloquée : ${lastError?.message || lastError || "Accès refusé"}. Utilisez l'option photo ci-dessous.`, "warning");
    return;
  }

  try {
    scannerStream = stream;
    videoElement.srcObject = stream;
    
    // Forcer la lecture pour s'assurer que le flux tourne (requis sur iOS PWA)
    await videoElement.play();
    console.log("Lecture de la vidéo OK");

    // Tentative d'application de l'autofocus continu de façon asynchrone sans faire crasher la caméra
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities) {
        const capabilities = videoTrack.getCapabilities();
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
          console.log("Autofocus continu activé");
        }
      }
    } catch (e) {
      console.warn("Impossible d'appliquer les contraintes autofocus avancées:", e);
    }

    // On lance ZXing UNIQUEMENT sur la vidéo qui tourne déjà parfaitement !
    zxingReader.decodeFromVideoElement(
      videoElement,
      (result, error) => {
        if (result && !isScannerProcessing) {
          isScannerProcessing = true;
          stopZxingCamera();
          onScanSuccess(result.getText());
        }
        if (error && !(error instanceof ZXing.NotFoundException)) {
          console.debug("Échec scan ZXing:", error);
        }
      }
    ).then(controls => {
      zxingControls = controls;
      showToast("Caméra prête. Scannez un code !", "success");
    }).catch(err => {
      console.error("Erreur decodeFromVideoElement:", err);
      showToast("Erreur d'initialisation du décodeur interne.", "error");
    });

  } catch (err) {
    console.error("Erreur de lancement de la vidéo:", err);
    stopZxingCamera();
    showToast("Impossible de lancer l'aperçu caméra.", "error");
  }
}

function stopZxingCamera() {
  if (zxingControls) {
    try { zxingControls.stop(); } catch (e) { console.warn(e); }
    zxingControls = null;
  }
  
  if (scannerStream) {
    try {
      scannerStream.getTracks().forEach(track => track.stop());
    } catch (e) { console.warn(e); }
    scannerStream = null;
  }
  
  const videoElement = document.getElementById('preview-video');
  if (videoElement) {
    try {
      if (videoElement.srcObject) {
        const stream = videoElement.srcObject;
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
      }
      videoElement.pause();
      videoElement.removeAttribute("src");
      try { videoElement.load(); } catch (_) {}
    } catch (e) { console.warn(e); }
  }
  
  if (zxingReader) {
    try { zxingReader.reset(); } catch (_) {}
  }
  
  isScannerProcessing = false;
}

function closeScanner() {
  const modalScanner = document.getElementById('scanner-modal');
  stopZxingCamera();
  modalScanner.close();
}

function onScanSuccess(decodedText, decodedResult) {
  if (navigator.vibrate) navigator.vibrate(50);
  closeScanner();

  if (currentScannerTarget === 'list') {
    FPVDatabase.getAll('batteries').then(batteries => {
      const found = batteries.find(b => b.barcode === decodedText);
      if (found) {
        openDetailsPanel(found);
        showToast("Batterie trouvée !", "success");
      } else {
        if (confirm(`Code inconnu (${decodedText}). Créer une batterie avec ce code ?`)) {
          openFormModal('battery', { barcode: decodedText });
        }
      }
    });
  } else if (currentScannerTarget === 'form') {
    const input = document.getElementById('f-barcode');
    if (input) {
      input.value = decodedText;
      showToast("Code assigné !", "success");
    }
  }
}

function onScanFailure(error) {
  // Silent, occurs often when not seeing a code
}

// Initialize scanner
setupScanner();

/* ==========================================================================
   FAVORITES LOGIC & REUSABLE CARD RENDERERS
   ========================================================================== */
function createDroneCard(drone) {
  const card = document.createElement('div');
  card.className = `fpv-card fpv-card-glow-violet`;
  card.innerHTML = `
    <div class="fpv-card-header">
      <div>
        <h3 class="fpv-card-title">${drone.name}</h3>
        <span class="fpv-card-subtitle">${drone.frame || 'Châssis générique'}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="btn-favorite-star ${drone.favorite ? 'is-favorite' : ''}" stop-propagation>★</button>
        <span class="badge badge-${drone.status.toLowerCase()}">${drone.status === 'Active' ? 'Actif' : drone.status === 'Repair' ? 'Réparation' : drone.status === 'Lost' ? 'Perdu' : 'Vendu'}</span>
      </div>
    </div>
    
    <div class="fpv-card-specs">
      <div class="spec-line">
        <span class="spec-key">Carte de vol</span>
        <span class="spec-val">${drone.fc || 'Non spécifiée'}</span>
      </div>
      <div class="spec-line">
        <span class="spec-key">Module VTX</span>
        <span class="spec-val">${drone.vtx || 'Non spécifié'}</span>
      </div>
      <div class="spec-line">
        <span class="spec-key">Firmware</span>
        <span class="spec-val">${drone.firmware || 'Non défini'}</span>
      </div>
    </div>
    
    <div class="fpv-card-footer">
      <span class="cost-tag">${drone.cost ? drone.cost + '€' : 'Inconnu'}</span>
      <span class="text-cyan" style="font-size: 0.8rem; font-weight: 600;">Détails →</span>
    </div>
  `;

  // Favorite button action
  const btnStar = card.querySelector('.btn-favorite-star');
  btnStar.addEventListener('click', (e) => {
    e.stopPropagation();
    drone.favorite = !drone.favorite;
    FPVDatabase.put('drones', drone).then(() => {
      refreshCurrentView();
      showToast(drone.favorite ? "Ajouté aux favoris ⭐" : "Retiré des favoris", "success");
    });
  });
  
  card.addEventListener('click', () => openDetailsPanel(drone));
  return card;
}

function createBatteryCard(batt) {
  const borderMap = { 'LiPo': 'green', 'LiHV': 'pink', 'LiIon': 'cyan' };
  const border = borderMap[batt.type] || 'violet';
  const statusLabel = batt.status === 'Storage' ? 'Stockage' : batt.status === 'Charged' ? 'Chargée' : batt.status === 'Discharged' ? 'Déchargée' : 'Hors Service';

  const card = document.createElement('div');
  card.className = `fpv-card fpv-card-glow-${border}`;
  card.innerHTML = `
    <div class="fpv-card-header">
      <div>
        <h3 class="fpv-card-title">${batt.name}</h3>
        <span class="fpv-card-subtitle">${batt.cells}S - ${batt.capacity}mAh (${batt.type})</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="btn-favorite-star ${batt.favorite ? 'is-favorite' : ''}" stop-propagation>★</button>
        <span class="badge badge-${batt.status.toLowerCase()}">${statusLabel}</span>
      </div>
    </div>
    
    <div class="fpv-card-specs">
      <div class="spec-line">
        <span class="spec-key">Décharge (C-Rating)</span>
        <span class="spec-val">${batt.cRating ? batt.cRating + 'C' : 'N/A'}</span>
      </div>
      <div class="spec-line">
        <span class="spec-key">Cycles enregistrés</span>
        <span class="spec-val" style="font-weight: 700;">${batt.cycles}</span>
      </div>
    </div>
    
    <div class="fpv-card-footer" style="padding-top: 10px;">
      <div class="cycles-incrementer" stop-propagation>
        <button class="cycles-btn btn-minus">-</button>
        <span class="cycles-value">${batt.cycles} cycles</span>
        <button class="cycles-btn btn-plus">+</button>
      </div>
      <span class="text-cyan text-detail-link" style="font-size: 0.8rem; font-weight: 600; cursor: pointer;">Santé →</span>
    </div>
  `;

  // Favorite button action
  const btnStar = card.querySelector('.btn-favorite-star');
  btnStar.addEventListener('click', (e) => {
    e.stopPropagation();
    batt.favorite = !batt.favorite;
    FPVDatabase.put('batteries', batt).then(() => {
      refreshCurrentView();
      showToast(batt.favorite ? "Ajouté aux favoris ⭐" : "Retiré des favoris", "success");
    });
  });

  const btnMinus = card.querySelector('.btn-minus');
  const btnPlus = card.querySelector('.btn-plus');
  const cycleText = card.querySelector('.cycles-value');

  btnMinus.addEventListener('click', (e) => {
    e.stopPropagation();
    if (batt.cycles > 0) {
      batt.cycles--;
      saveBatteryCycles(batt, cycleText);
    }
  });

  btnPlus.addEventListener('click', (e) => {
    e.stopPropagation();
    batt.cycles++;
    saveBatteryCycles(batt, cycleText);
  });

  card.querySelector('.cycles-incrementer').addEventListener('click', (e) => e.stopPropagation());
  card.addEventListener('click', () => openDetailsPanel(batt));
  return card;
}

function createProjectCard(proj) {
  const spent = proj.components.reduce((sum, c) => sum + (c.status === 'Arrived' || c.status === 'Ordered' ? c.price : 0), 0);
  const totalTasks = proj.checklist.length;
  const completedTasks = proj.checklist.filter(t => t.completed).length;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const card = document.createElement('div');
  card.className = `fpv-card fpv-card-glow-orange`;
  card.innerHTML = `
    <div class="fpv-card-header">
      <div>
        <h3 class="fpv-card-title">${proj.name}</h3>
        <span class="fpv-card-subtitle">${proj.status === 'Planning' ? 'Planification' : proj.status === 'In Progress' ? 'Montage' : proj.status === 'Testing' ? 'Bancs de test' : 'Terminé'}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="btn-favorite-star ${proj.favorite ? 'is-favorite' : ''}" stop-propagation>★</button>
        <span class="badge" style="background: rgba(249, 115, 22, 0.15); color: var(--orange); border: 1px solid rgba(249, 115, 22, 0.2);">${pct}%</span>
      </div>
    </div>

    <p class="text-muted" style="font-size: 0.85rem; line-height: 1.4; margin: 6px 0 12px 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
      ${proj.description || 'Pas de description.'}
    </p>

    <div style="background: rgba(255,255,255,0.06); height: 8px; border-radius: 10px; overflow: hidden; margin-bottom: 12px;">
      <div style="width: ${pct}%; background: linear-gradient(90deg, var(--orange) 0%, var(--secondary) 100%); height: 100%; border-radius: 10px; transition: width 0.3s;"></div>
    </div>
    
    <div class="fpv-card-footer">
      <div style="font-size: 0.8rem;">
        <span class="spec-key">Investi :</span>
        <span style="font-weight: 700; color: #fff;">${spent}€</span> 
        <span class="spec-key">/ Budget :</span>
        <span style="font-weight: 500; color: var(--text-muted);">${proj.budget}€</span>
      </div>
      <span class="text-cyan" style="font-size: 0.8rem; font-weight: 600;">Dossier →</span>
    </div>
  `;

  // Favorite button action
  const btnStar = card.querySelector('.btn-favorite-star');
  btnStar.addEventListener('click', (e) => {
    e.stopPropagation();
    proj.favorite = !proj.favorite;
    FPVDatabase.put('projects', proj).then(() => {
      refreshCurrentView();
      showToast(proj.favorite ? "Ajouté aux favoris ⭐" : "Retiré des favoris", "success");
    });
  });

  card.addEventListener('click', () => openDetailsPanel(proj));
  return card;
}

function createWishlistCard(item) {
  const elem = document.createElement('div');
  elem.className = 'wish-item';
  const priorityLabel = item.priority === 'High' ? 'Priorité Haute' : item.priority === 'Medium' ? 'Moyenne' : 'Basse';

  elem.innerHTML = `
    <div class="wish-left">
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="btn-favorite-star ${item.favorite ? 'is-favorite' : ''}" style="padding: 0; font-size: 1.15rem;">★</button>
        <div class="priority-indicator priority-${item.priority}"></div>
        <span class="wish-title">${item.name}</span>
      </div>
      <div class="wish-meta">
        <span>Catégorie : ${item.category}</span>
        <span>•</span>
        <span class="text-${item.priority === 'High' ? 'red' : item.priority === 'Medium' ? 'orange' : 'cyan'}">${priorityLabel}</span>
      </div>
      ${item.notes ? `<p class="text-muted" style="font-size: 0.8rem; line-height: 1.3; margin-top: 4px;">${item.notes}</p>` : ''}
    </div>
    <div class="wish-right">
      <span style="font-weight: 800; color: #fff; font-size: 1.15rem;">${item.price}€</span>
      <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
        <button class="btn-small-view btn-wish-edit" style="background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
        <button class="btn-small-view btn-wish-delete" style="background: rgba(239, 68, 68, 0.15); color: var(--red); border-color: rgba(239, 68, 68, 0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        ${item.link ? `<a href="${item.link}" target="_blank" class="btn-small-view" style="text-decoration: none;">Acheter ↗</a>` : ''}
        <button class="btn-small-view btn-wish-convert" style="background: rgba(124,77,255,0.12); color: var(--primary); border-color: rgba(124,77,255,0.25);">Convertir</button>
      </div>
    </div>
  `;

  // Favorite button action
  const btnStar = elem.querySelector('.btn-favorite-star');
  btnStar.addEventListener('click', (e) => {
    e.stopPropagation();
    item.favorite = !item.favorite;
    FPVDatabase.put('wishlist', item).then(() => {
      refreshCurrentView();
      showToast(item.favorite ? "Ajouté aux favoris ⭐" : "Retiré des favoris", "success");
    });
  });

  elem.querySelector('.btn-wish-convert').addEventListener('click', () => {
    convertWishlistItem(item);
  });

  elem.querySelector('.btn-wish-edit').addEventListener('click', () => {
    openFormModal('wishlist', item);
  });

  elem.querySelector('.btn-wish-delete').addEventListener('click', () => {
    FPVDatabase.delete('wishlist', item.id).then(() => {
      refreshCurrentView();
      showToast("Élément supprimé.", "info");
    });
  });

  return elem;
}

function renderFavorites() {
  const container = document.getElementById('favorites-list-container');
  const activeSegment = document.querySelector('.segment-btn.active')?.dataset.segment || 'all';

  if (!container) return;

  Promise.all([
    FPVDatabase.getAll('drones'),
    FPVDatabase.getAll('batteries'),
    FPVDatabase.getAll('projects'),
    FPVDatabase.getAll('wishlist')
  ]).then(([drones, batteries, projects, wishlist]) => {
    // Filter favorites
    const favDrones = drones.filter(d => d.favorite);
    const favBatteries = batteries.filter(b => b.favorite);
    const favProjects = projects.filter(p => p.favorite);
    const favWishlist = wishlist.filter(w => w.favorite);

    const totalCount = favDrones.length + favBatteries.length + favProjects.length + favWishlist.length;

    container.innerHTML = '';
    
    if (totalCount === 0) {
      container.innerHTML = `
        <div class="info-card" style="grid-column: 1/-1; text-align: center; padding: 40px 20px; border-left: 4px solid var(--primary);">
          <p class="text-muted" style="margin: 0; font-size: 0.9rem;">Aucun élément favori pour le moment. Cliquez sur l'étoile ★ de vos équipements pour les retrouver ici !</p>
        </div>
      `;
      return;
    }

    let renderedAny = false;

    // 1. DRONES SECTION
    if ((activeSegment === 'all' || activeSegment === 'drones') && favDrones.length > 0) {
      renderedAny = true;
      const title = document.createElement('h3');
      title.className = 'favorites-section-header';
      title.innerHTML = `🛸 Drones Favoris (${favDrones.length})`;
      container.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'cards-grid';
      container.appendChild(grid);

      favDrones.forEach(drone => {
        const card = createDroneCard(drone);
        grid.appendChild(card);
      });
    }

    // 2. BATTERIES SECTION
    if ((activeSegment === 'all' || activeSegment === 'batteries') && favBatteries.length > 0) {
      renderedAny = true;
      const title = document.createElement('h3');
      title.className = 'favorites-section-header';
      title.innerHTML = `🔋 Batteries Favorites (${favBatteries.length})`;
      container.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'cards-grid';
      container.appendChild(grid);

      favBatteries.forEach(batt => {
        const card = createBatteryCard(batt);
        grid.appendChild(card);
      });
    }

    // 3. PROJECTS SECTION
    if ((activeSegment === 'all' || activeSegment === 'projects') && favProjects.length > 0) {
      renderedAny = true;
      const title = document.createElement('h3');
      title.className = 'favorites-section-header';
      title.innerHTML = `⚙️ Projets Favoris (${favProjects.length})`;
      container.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'cards-grid';
      container.appendChild(grid);

      favProjects.forEach(proj => {
        const card = createProjectCard(proj);
        grid.appendChild(card);
      });
    }

    // 4. WISHLIST SECTION
    if ((activeSegment === 'all' || activeSegment === 'wishlist') && favWishlist.length > 0) {
      renderedAny = true;
      const title = document.createElement('h3');
      title.className = 'favorites-section-header';
      title.innerHTML = `💖 Wishlist Favorite (${favWishlist.length})`;
      container.appendChild(title);

      const listContainer = document.createElement('div');
      listContainer.style.display = 'flex';
      listContainer.style.flexDirection = 'column';
      listContainer.style.gap = '10px';
      container.appendChild(listContainer);

      favWishlist.forEach(item => {
        const elem = createWishlistCard(item);
        listContainer.appendChild(elem);
      });
    }

    if (!renderedAny) {
      container.innerHTML = `
        <div class="info-card" style="grid-column: 1/-1; text-align: center; padding: 40px 20px; border-left: 4px solid var(--primary);">
          <p class="text-muted" style="margin: 0; font-size: 0.9rem;">Aucun élément dans cette catégorie de favoris.</p>
        </div>
      `;
    }
  });
}


