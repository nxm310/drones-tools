/**
 * FPV Drone & Battery Manager - Betaflight CLI Parser
 * Parses Betaflight dumps and diffs to extract setup specifications.
 */

const BetaflightParser = {
  /**
   * Parse a raw CLI string line-by-line
   * @param {string} rawCliText 
   * @returns {Object} Parsed configuration details
   */
  parse(rawCliText) {
    const result = {
      name: '',
      firmwareVersion: '',
      firmwareDate: '',
      boardName: '',
      motorProtocol: '',
      rxProvider: '',
      features: [],
      uarts: []
    };

    if (!rawCliText || typeof rawCliText !== 'string') {
      return result;
    }

    const lines = rawCliText.split('\n');

    // Mappings for UART functions in Betaflight
    const uartFunctions = {
      1: 'MSP (Configuration)',
      2: 'GPS',
      4: 'Télémesure ESC',
      32: 'SmartAudio (VTX)',
      64: 'Serial RX (Récepteur)',
      128: 'Tramp (VTX)',
      1024: 'GPS (Positionnement)'
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // 1. Parse Version & Firmware Name
      // Example: # Betaflight / STM32H743 (S743) 4.5.0 May  1 2024 / 14:23:45
      if (trimmed.startsWith('# Betaflight') || trimmed.startsWith('# INAV')) {
        const parts = trimmed.split('/');
        if (parts.length >= 2) {
          const rawVersion = parts[1].trim();
          // Extract version number like 4.5.0 or 7.1.0
          const versionMatch = rawVersion.match(/(\d+\.\d+\.\d+)/);
          result.firmwareVersion = versionMatch ? versionMatch[0] : rawVersion;
        }
        if (parts.length >= 3) {
          result.firmwareDate = parts[2].trim();
        }
      }

      // 2. Parse Board Name
      // Example: # board_name KAKUTEH7V2
      // Example: board_name KAKUTEH7V2
      if (trimmed.includes('board_name')) {
        const parts = trimmed.split('board_name');
        if (parts.length >= 2) {
          result.boardName = parts[1].trim();
        }
      }

      // 3. Parse Craft Name
      // Example: name Apex 5 Freestyle
      // Example: set name = Apex 5 Freestyle
      if (trimmed.startsWith('name ') || trimmed.startsWith('set name ')) {
        const nameParts = trimmed.replace('set name =', '').replace('name', '').trim();
        result.name = nameParts.replace(/"/g, ''); // strip quotes
      }

      // 4. Parse Motor PWM Protocol
      // Example: set motor_pwm_protocol = DSHOT600
      if (trimmed.includes('motor_pwm_protocol')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          result.motorProtocol = parts[1].trim();
        }
      }

      // 5. Parse Receiver Provider
      // Example: set rx_provider = CRSF
      if (trimmed.includes('rx_provider')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          result.rxProvider = parts[1].trim();
        }
      }

      // 6. Parse Features
      // Example: feature RX_SERIAL
      if (trimmed.startsWith('feature ')) {
        const featureName = trimmed.replace('feature', '').trim();
        if (featureName && !result.features.includes(featureName)) {
          result.features.push(featureName);
        }
      }

      // 7. Parse UART / Serial ports mapping
      // Example: serial 0 1 115200 57600 0 115200
      // serial <index> <function> <msp-baud> <gps-baud> ...
      if (trimmed.startsWith('serial ')) {
        const tokens = trimmed.split(/\s+/);
        if (tokens.length >= 3) {
          const index = parseInt(tokens[1], 10);
          const funcCode = parseInt(tokens[2], 10);
          const uartName = `UART${index + 1}`;

          // Map function code to human readable text
          let activeFuncs = [];
          
          // Check bitmask or direct match for common functions
          if (funcCode === 1) {
            activeFuncs.push(uartFunctions[1]);
          } else {
            // Check flags
            Object.keys(uartFunctions).forEach(code => {
              const codeInt = parseInt(code, 10);
              if (codeInt > 1 && (funcCode & codeInt) !== 0) {
                activeFuncs.push(uartFunctions[code]);
              }
            });
          }

          if (activeFuncs.length > 0) {
            result.uarts.push({
              port: uartName,
              functions: activeFuncs.join(' + ')
            });
          }
        }
      }
    });

    return result;
  },

  /**
   * Render the parsed result into highly aesthetic HTML
   * @param {Object} data The parsed CLI object
   * @returns {string} HTML code to display
   */
  renderHTML(data) {
    if (!data.firmwareVersion && !data.boardName && !data.name) {
      return `
        <div class="info-card" style="border-left-color: var(--red);">
          <p class="text-red" style="font-size: 0.9rem; font-weight: 600;">Aucune spécification Betaflight CLI détectée.</p>
          <p style="font-size: 0.8rem; margin-top: 4px;">Collez un fichier dump ou diff complet dans l'édition du drone pour voir apparaître les spécifications matérielles.</p>
        </div>
      `;
    }

    let featuresHTML = data.features.length > 0 
      ? data.features.map(f => `<span class="badge" style="background: rgba(124, 77, 255, 0.12); color: var(--primary); margin: 2px; border: 1px solid rgba(124, 77, 255, 0.2);">${f}</span>`).join('')
      : '<span class="text-muted">Aucune</span>';

    let uartsHTML = data.uarts.length > 0
      ? data.uarts.map(u => `
          <div class="spec-line" style="background: rgba(255,255,255,0.01); padding: 8px; border-radius: 8px; border: 1px solid var(--surface-border);">
            <span class="spec-key" style="font-family: var(--font-mono); font-weight: bold; color: var(--cyan);">${u.port}</span>
            <span class="spec-val" style="font-size: 0.8rem;">${u.functions}</span>
          </div>
        `).join('')
      : '<span class="text-muted">Aucune affectation de port détectée.</span>';

    return `
      <div class="detail-banner" style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(124, 77, 255, 0.05) 100%); border-color: rgba(6, 182, 212, 0.3);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h4 style="color: #fff; font-size: 1.1rem; font-weight: 700;">Analyse Betaflight CLI</h4>
          <span class="badge badge-charged" style="font-family: var(--font-mono);">${data.firmwareVersion || 'Betaflight'}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: -6px;">Données extraites automatiquement de la configuration de vol.</p>
      </div>

      <div class="specs-grid">
        <div class="spec-box">
          <div class="spec-box-label">Contrôleur de Vol (Target)</div>
          <div class="spec-box-value" style="font-family: var(--font-mono); color: var(--cyan); font-size: 0.9rem;">${data.boardName || 'Inconnu'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Nom du Drone (CLI)</div>
          <div class="spec-box-value" style="color: #fff; font-size: 0.9rem;">${data.name || 'Sans nom'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Protocole Moteurs</div>
          <div class="spec-box-value" style="font-family: var(--font-mono); color: var(--orange); font-size: 0.9rem;">${data.motorProtocol || 'DSHOT600 (défaut)'}</div>
        </div>
        <div class="spec-box">
          <div class="spec-box-label">Protocole Réception</div>
          <div class="spec-box-value" style="font-family: var(--font-mono); color: var(--green); font-size: 0.9rem;">${data.rxProvider || 'CRSF (ELRS)'}</div>
        </div>
      </div>

      <div class="detail-section-title">Fonctionnalités Activées</div>
      <div style="display: flex; flex-wrap: wrap; gap: 4px; padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--surface-border); border-radius: 12px;">
        ${featuresHTML}
      </div>

      <div class="detail-section-title">Configuration des Ports (UARTs)</div>
      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
        ${uartsHTML}
      </div>
    `;
  }
};
