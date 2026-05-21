/**
 * FPV Drone & Battery Manager - Database Layer
 * Wraps IndexedDB operations in standard JS Promises
 */

const DB_NAME = 'FPV_Drone_Manager_DB';
const DB_VERSION = 1;

const FPVDatabase = {
  db: null,

  /**
   * Initialize the IndexedDB instance
   */
  init() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        return resolve(this.db);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("Erreur d'ouverture de la base IndexedDB:", event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log("Base de données IndexedDB ouverte avec succès.");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log("Mise à jour / Création de la base de données...");

        // Store 1: Drones
        if (!db.objectStoreNames.contains('drones')) {
          db.createObjectStore('drones', { keyPath: 'id' });
        }

        // Store 2: Batteries
        if (!db.objectStoreNames.contains('batteries')) {
          db.createObjectStore('batteries', { keyPath: 'id' });
        }

        // Store 3: Projects
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        // Store 4: Wishlist
        if (!db.objectStoreNames.contains('wishlist')) {
          db.createObjectStore('wishlist', { keyPath: 'id' });
        }
      };
    });
  },

  /**
   * Get all items from a store
   */
  getAll(storeName) {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(e.target.error);
      });
    });
  },

  /**
   * Get a specific item by ID
   */
  get(storeName, id) {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
    });
  },

  /**
   * Add a new item to a store
   */
  add(storeName, item) {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);

        request.onsuccess = () => resolve(item);
        request.onerror = (e) => reject(e.target.error);
      });
    });
  },

  /**
   * Update an existing item (or add it if it doesn't exist)
   */
  put(storeName, item) {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve(item);
        request.onerror = (e) => reject(e.target.error);
      });
    });
  },

  /**
   * Delete an item by ID
   */
  delete(storeName, id) {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve(id);
        request.onerror = (e) => reject(e.target.error);
      });
    });
  },

  /**
   * Clear all items in a store
   */
  clearStore(storeName) {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
    });
  },

  /**
   * Clear the entire database and reload clean state
   */
  clearAll() {
    return Promise.all([
      this.clearStore('drones'),
      this.clearStore('batteries'),
      this.clearStore('projects'),
      this.clearStore('wishlist')
    ]);
  },

  /**
   * Load rich FPV demo data to showcase the web app features
   */
  loadDemoData() {
    return this.clearAll().then(() => {
      const promises = [];

      // Demo Drones
      const demoDrones = [
        {
          id: 'drone-1',
          name: 'Apex 5" Freestyle',
          status: 'Active',
          frame: 'ImpulseRC Apex 5" HD',
          fc: 'Kakute H7 v2',
          esc: 'Tekko32 F4 Metal 65A',
          vtx: 'DJI O3 Air Unit',
          camera: 'DJI O3 Camera',
          motors: 'T-Motor Xing2 2207 1950KV',
          rx: 'ExpressLRS 2.4GHz (EP1)',
          firmware: 'Betaflight 4.5.0',
          purchaseDate: '2025-10-12',
          cost: 489,
          betaflightConfig: `# version\n# Betaflight / STM32H743 (S743) 4.5.0 May  1 2024 / 14:23:45 (3ab293e84)\n# board_name KAKUTEH7V2\n\n# name\nname Apex 5 Freestyle\n\n# feature\nfeature RX_SERIAL\nfeature OSD\nfeature TELEMETRY\n\n# serial\nserial 0 1 115200 57600 0 115200\nserial 1 64 115200 57600 0 115200\n\n# aux\naux 0 0 0 1700 2100 0 0\naux 1 1 2 1300 1700 0 0\naux 2 2 1 1300 2100 0 0\n\n# master\nset motor_pwm_protocol = DSHOT600\nset rx_provider = CRSF\nset telemetry_disabled_sensors = 0\nset osd_units = METRIC\nset pid_process_denom = 1\n`,
          invoices: [
            {
              id: 'inv-1-1',
              name: 'Facture Drone-FPV Shop (Frame & Moteurs)',
              date: '2025-10-10',
              amount: 299,
              // Lightweight placeholder Base64 image representing a receipt
              fileData: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="100%" height="100%" fill="%23f9fafb"/><text x="20" y="40" font-family="monospace" font-size="16" fill="%23111827">DRONE-FPV SHOP</text><text x="20" y="70" font-family="monospace" font-size="12" fill="%236b7280">Facture N: F-2025-9844</text><text x="20" y="90" font-family="monospace" font-size="12" fill="%236b7280">Date: 10 Oct 2025</text><line x1="20" y1="110" x2="280" y2="110" stroke="%23e5e7eb" stroke-width="2"/><text x="20" y="140" font-family="monospace" font-size="12" fill="%23374151">1x ImpulseRC Apex 5" Frame   99.00 EUR</text><text x="20" y="170" font-family="monospace" font-size="12" fill="%23374151">4x Xing2 2207 Motors        200.00 EUR</text><line x1="20" y1="300" x2="280" y2="300" stroke="%23e5e7eb" stroke-width="2"/><text x="20" y="340" font-family="monospace" font-size="14" font-weight="bold" fill="%23111827">TOTAL: 299.00 EUR</text></svg>'
            }
          ],
          notes: 'Mon quad freestyle principal. Réglé à la perfection avec filtres RPM et curseurs PID poussés.'
        },
        {
          id: 'drone-2',
          name: 'Crux35 Micro-Longrange',
          status: 'Repair',
          frame: 'Crux35 3.5" Ultralight',
          fc: 'Crazybee F4 AIO v2',
          esc: 'Onboard 20A 4-in-1',
          vtx: 'Caddx Vista (Nebula Pro)',
          camera: 'Nebula Pro Nano',
          motors: 'HappyModel 1404 3500KV',
          rx: 'ExpressLRS 2.4GHz',
          firmware: 'Betaflight 4.4.2',
          purchaseDate: '2024-06-15',
          cost: 210,
          betaflightConfig: `# version\n# Betaflight / STM32F411 (S411) 4.4.2 Jun 12 2023 / 08:30:15\n# board_name CRAZYBEEF4DX\nname Crux35\nset motor_pwm_protocol = DSHOT300\nset rx_provider = CRSF\n`,
          invoices: [],
          notes: 'Moteur avant droit cassé après crash contre un arbre. Remplacement commandé.'
        },
        {
          id: 'drone-3',
          name: 'Explorer LR 4"',
          status: 'Active',
          frame: 'Flywoo Explorer LR 4" HD',
          fc: 'Flywoo GOKU GN405 Nano',
          esc: 'GOKU 13A AIO',
          vtx: 'DJI O3 Air Unit',
          camera: 'DJI O3 Camera',
          motors: 'NIN V2 1404 2750KV',
          rx: 'TBS Crossfire Nano RX',
          firmware: 'INAV 7.1.0',
          purchaseDate: '2025-02-18',
          cost: 380,
          betaflightConfig: `# version\n# INAV / MATEKF405SE 7.1.0\n# board_name GOKUF405\n`,
          invoices: [],
          notes: 'Quad de Long Range de 4 pouces. Capable de voler pendant 15 minutes avec une batterie LiIon 4S 3000mAh.'
        }
      ];
      demoDrones.forEach(d => promises.push(this.add('drones', d)));

      // Demo Batteries
      const demoBatteries = [
        {
          id: 'batt-1',
          name: 'Tattu R-Line v5 6S 1400mAh',
          type: 'LiPo',
          cells: 6,
          capacity: 1400,
          cRating: 150,
          cycles: 8,
          status: 'Charged',
          internalResistance: [8.2, 8.5, 8.1, 8.3, 8.4, 8.2],
          purchaseDate: '2025-09-01',
          notes: 'Performance absolue, pas de sag, toujours stockée à 3.85V.'
        },
        {
          id: 'batt-2',
          name: 'CNHL Black Series 6S 1300mAh',
          type: 'LiPo',
          cells: 6,
          capacity: 1300,
          cRating: 100,
          cycles: 24,
          status: 'Storage',
          internalResistance: [12.1, 12.8, 14.2, 12.0, 13.5, 12.4],
          purchaseDate: '2024-11-10',
          notes: 'Pack solide pour l\'entraînement de tous les jours.'
        },
        {
          id: 'batt-3',
          name: 'Molicel LiIon 4S 3000mAh VTC6',
          type: 'LiIon',
          cells: 4,
          capacity: 3000,
          cRating: 30,
          cycles: 12,
          status: 'Storage',
          internalResistance: [22.4, 23.1, 22.8, 22.5],
          purchaseDate: '2025-03-01',
          notes: 'Batterie sur mesure construite pour l\'Explorer LR 4". Décharge constante.'
        },
        {
          id: 'batt-4',
          name: 'Ovonic 4S 1500mAh 100C',
          type: 'LiPo',
          cells: 4,
          capacity: 1500,
          cRating: 100,
          cycles: 46,
          status: 'Retired',
          internalResistance: [24.1, 28.5, 31.0, 25.4],
          purchaseDate: '2024-04-12',
          notes: 'Cellule 3 fatiguée (résistance trop haute). Gonflée, retirée du vol de sécurité.'
        }
      ];
      demoBatteries.forEach(b => promises.push(this.add('batteries', b)));

      // Demo Projects
      const demoProjects = [
        {
          id: 'proj-1',
          name: 'Projet Cinewhoop 3" O3',
          description: 'Création d\'un cinewhoop de 3 pouces amorti et caréné pour filmer en intérieur et autour des personnes en toute sécurité.',
          status: 'In Progress',
          budget: 350,
          components: [
            { name: 'Châssis Reptile Cloud 149 V2', price: 39, status: 'Arrived' },
            { name: 'Moteurs T-Motor F1507 2700KV', price: 72, status: 'Ordered' },
            { name: 'Stack AIO GOKU F745 40A v2', price: 95, status: 'Arrived' },
            { name: 'DJI O3 Air Unit (Déjà en stock)', price: 0, status: 'Arrived' },
            { name: 'Hélices HQProp Duct 3 (x10)', price: 15, status: 'Needed' }
          ],
          checklist: [
            { text: 'Assembler la frame Reptile Cloud', completed: true },
            { text: 'Souder le récepteur ELRS sur la carte AIO', completed: true },
            { text: 'Fixer la stack et souder les moteurs', completed: false },
            { text: 'Installer le module DJI O3', completed: false },
            { text: 'Paramétrage Betaflight (Softmount et filtres bidirectionnels)', completed: false },
            { text: 'Premier vol d\'essai (Maiden)', completed: false }
          ],
          notes: 'Les moteurs arrivent cette semaine par Drone-FPV Shop. Commencer les soudures d\'alimentation dès réception.'
        },
        {
          id: 'proj-2',
          name: 'Montage LongRange 7 pouces',
          description: 'Quadricoptère de 7 pouces conçu pour l\'exploration en montagne et le vol de croisière à longue distance.',
          status: 'Planning',
          budget: 650,
          components: [
            { name: 'Frame Chimera7 Pro V2', price: 129, status: 'Needed' },
            { name: 'Moteurs Xing2 2809 1250KV', price: 140, status: 'Needed' },
            { name: 'Stack SpeedyBee F405 V3 50A', price: 69, status: 'Needed' },
            { name: 'GPS Flywoo Goku M10 Pro', price: 29, status: 'Needed' }
          ],
          checklist: [
            { text: 'Commander toutes les pièces sélectionnées', completed: false },
            { text: 'Préparer le fer à souder TS101 et l\'étain', completed: false }
          ],
          notes: 'Projet pour l\'été 2026. Attente de la baisse du prix des caméras O3.'
        }
      ];
      demoProjects.forEach(p => promises.push(this.add('projects', p)));

      // Demo Wishlist
      const demoWishlist = [
        {
          id: 'wish-1',
          name: 'Radiomaster Boxer ELRS Carbon',
          price: 189,
          link: 'https://www.radiomasterrc.com/products/boxer-radio-controller',
          priority: 'High',
          category: 'Gear',
          notes: 'Pour remplacer ma vieille TX12 qui commence à fatiguer au niveau des gimbals.'
        },
        {
          id: 'wish-2',
          name: 'DJI Goggles 3',
          price: 659,
          link: 'https://store.dji.com',
          priority: 'High',
          category: 'Gear',
          notes: 'Achat majeur pour le passage en HD O3 haut de gamme.'
        },
        {
          id: 'wish-3',
          name: 'Hélices Ethix S3 Watermelon (x10)',
          price: 35,
          link: 'https://www.drone-fpv-shop.com',
          priority: 'Medium',
          category: 'Part',
          notes: 'Consommable indispensable pour l\'Apex 5.'
        },
        {
          id: 'wish-4',
          name: 'Fer à souder nomade Pinecil V2',
          price: 45,
          link: 'https://pine64.org',
          priority: 'Low',
          category: 'Gear',
          notes: 'Très utile pour réparer directement sur le terrain à partir d\'une LiPo 4S.'
        }
      ];
      demoWishlist.forEach(w => promises.push(this.add('wishlist', w)));

      return Promise.all(promises);
    });
  }
};

// Auto-initialize the DB when the file is included
FPVDatabase.init().catch(err => {
  console.error("Échec d'initialisation de la DB FPV:", err);
});
