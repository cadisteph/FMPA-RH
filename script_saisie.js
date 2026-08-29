// --- ÉTAT GLOBAL DE L'APPLICATION ---
let agentsData = [];
let suiviHistorique = []; // Liste de toutes les saisies effectuées
let catalogueFormations = [];
let selectedAgentIds = new Set();

// --- INITIALISATION AU CHARGEMENT ---
document.addEventListener('DOMContentLoaded', () => {
    initFormDefaults();
    setupEventListeners();
    loadCatalogue();
});

function initFormDefaults() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('saisie-date').value = today;
    calculerDuree();
}

function setupEventListeners() {
    // Calcul de durée auto
    document.getElementById('saisie-heure-debut').addEventListener('change', calculerDuree);
    document.getElementById('saisie-heure-fin').addEventListener('change', calculerDuree);

    // Imports / Exports
    document.getElementById('btn-import-csv').addEventListener('click', () => document.getElementById('file-input-csv').click());
    document.getElementById('file-input-csv').addEventListener('change', importerBaseAgents);

    document.getElementById('btn-import-suivi').addEventListener('click', () => document.getElementById('file-input-suivi').click());
    document.getElementById('file-input-suivi').addEventListener('change', importerSuiviCSV);

    // Import Catalogue manuel (AJOUTÉ)
    document.getElementById('btn-import-catalogue')?.addEventListener('click', () => document.getElementById('file-input-catalogue').click());
    document.getElementById('file-input-catalogue')?.addEventListener('change', importerCatalogueCSV);

    document.getElementById('btn-export-csv').addEventListener('click', exporterSuiviCSV);

    // Filtres
    document.getElementById('filter-equipe').addEventListener('change', appliquerFiltres);
    document.getElementById('filter-statut').addEventListener('change', appliquerFiltres);
    document.getElementById('filter-search').addEventListener('input', appliquerFiltres);
    document.getElementById('btn-reset-filters').addEventListener('click', reinitialiserFiltres);

    // Sélection globale
    document.getElementById('select-all').addEventListener('change', toutSelectionner);

    // Formulaire cascade Domaine -> Thème
    document.getElementById('saisie-activite').addEventListener('change', onDomaineChange);
    document.getElementById('saisie-theme').addEventListener('change', onThemeChange);

    // Soumission du formulaire
    document.getElementById('form-saisie-groupee').addEventListener('submit', validerSaisieGroupee);
}

// --- CATALOGUE DES FORMATIONS ---
function loadCatalogue() {
    fetch('catalogue.csv')
        .then(response => {
            if (!response.ok) throw new Error('Catalogue introuvable');
            return response.text();
        })
        .then(csvText => {
            catalogueFormations = parseCSV(csvText);
            remplirDomaines();
        })
        .catch(err => {
            console.warn("Impossible de charger catalogue.csv automatiquement (CORS/404). Utilise le bouton d'import manuel.", err);
        });
}

// Fonction d'importation manuelle (AJOUTÉE)
function importerCatalogueCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        catalogueFormations = parseCSV(evt.target.result);
        remplirDomaines();
        alert("✅ Catalogue chargé avec succès !");
    };
    reader.readAsText(file, 'UTF-8');
}

function remplirDomaines() {
    const selectDomaine = document.getElementById('saisie-activite');
    selectDomaine.innerHTML = '<option value="">-- Choisir un domaine --</option>';

    if (!catalogueFormations || catalogueFormations.length === 0) return;

    // Détection automatique du nom de la colonne du domaine
    const sample = catalogueFormations[0];
    const keyDomaine = Object.keys(sample).find(k => k.trim().toLowerCase().includes('domaine')) || 'Domaine';

    const domaines = [...new Set(catalogueFormations.map(f => f[keyDomaine]).filter(Boolean))];

    if (domaines.length === 0) {
        alert("⚠️ Le CSV a été lu mais aucune colonne 'Domaine' n'a été détectée. Vérifie les entêtes de ton fichier CSV.");
        return;
    }

    domaines.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        selectDomaine.appendChild(opt);
    });
}

function onDomaineChange() {
    const domaine = document.getElementById('saisie-activite').value;
    const selectTheme = document.getElementById('saisie-theme');
    selectTheme.innerHTML = '<option value="">-- Choisir une formation --</option>';

    if (!domaine) {
        selectTheme.disabled = true;
        recalculerCompatibiliteAgents(null);
        return;
    }

    const formationsFiltrees = catalogueFormations.filter(f => f.Domaine === domaine);
    formationsFiltrees.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.ID_Formation || f.Theme;
        const detail = f.Contenu || f.Sequence || f.Description || '';
        opt.textContent = `${f.Theme} ${detail ? ' - ' + detail : ''}`;
        selectTheme.appendChild(opt);
    });

    selectTheme.disabled = false;
}

function onThemeChange() {
    const themeId = document.getElementById('saisie-theme').value;
    const formation = catalogueFormations.find(f => (f.ID_Formation || f.Theme) === themeId);
    recalculerCompatibiliteAgents(formation);
    actualiserEtatBoutonValidation();
}

// --- CALCUL DE LA DURÉE EN HEURES ---
function calculerDuree() {
    const debut = document.getElementById('saisie-heure-debut').value;
    const fin = document.getElementById('saisie-heure-fin').value;

    if (debut && fin) {
        const [hD, mD] = debut.split(':').map(Number);
        const [hF, mF] = fin.split(':').map(Number);

        let minDebut = hD * 60 + mD;
        let minFin = hF * 60 + mF;

        if (minFin <= minDebut) minFin += 24 * 60; // Gestion dépassement minuit

        const dureeHeures = ((minFin - minDebut) / 60).toFixed(1);
        document.getElementById('duree-calculee').textContent = `${dureeHeures} h`;
        return parseFloat(dureeHeures);
    }
    return 0;
}

// --- ANALYSEURS CSV (SANS PAPAPARSE) ---
function parseCSV(text) {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = splitCSVLine(lines[0]);
    return lines.slice(1).map(line => {
        const values = splitCSVLine(line);
        let obj = {};
        headers.forEach((h, i) => {
            obj[h.trim()] = values[i] ? values[i].trim() : '';
        });
        return obj;
    });
}

function splitCSVLine(line) {
    let result = [];
    let insideQuotes = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
        let char = line[i];
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if ((char === ';' || char === ',') && !insideQuotes) {
            result.push(entry);
            entry = '';
        } else {
            entry += char;
        }
    }
    result.push(entry);
    return result;
}

// --- IMPORTATION ET TRAITEMENT DES AGENTS ---
function importerBaseAgents(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        agentsData = parseCSV(evt.target.result);
        remplirFiltresOptions();
        afficherTableauAgents();
    };
    reader.readAsText(file, 'UTF-8');
}

function importerSuiviCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        suiviHistorique = parseCSV(evt.target.result);
        afficherTableauAgents();
    };
    reader.readAsText(file, 'UTF-8');
}

// --- FILTRES & AFFICHAGE TABLEAU ---
function remplirFiltresOptions() {
    const selectEquipe = document.getElementById('filter-equipe');
    const selectStatut = document.getElementById('filter-statut');

    const equipes = [...new Set(agentsData.map(a => a.Equipe).filter(Boolean))];
    const statuts = [...new Set(agentsData.map(a => a.Statut).filter(Boolean))];

    selectEquipe.innerHTML = '<option value="">Toutes</option>';
    equipes.forEach(eq => selectEquipe.innerHTML += `<option value="${eq}">${eq}</option>`);

    selectStatut.innerHTML = '<option value="">Tous</option>';
    statuts.forEach(st => selectStatut.innerHTML += `<option value="${st}">${st}</option>`);
}

function appliquerFiltres() {
    afficherTableauAgents();
}

function reinitialiserFiltres() {
    document.getElementById('filter-equipe').value = '';
    document.getElementById('filter-statut').value = '';
    document.getElementById('filter-search').value = '';
    afficherTableauAgents();
}

function afficherTableauAgents() {
    const tbody = document.getElementById('tbody-agents');
    tbody.innerHTML = '';

    const eqFilter = document.getElementById('filter-equipe').value;
    const stFilter = document.getElementById('filter-statut').value;
    const searchFilter = document.getElementById('filter-search').value.toLowerCase();

    const agentsFiltres = agentsData.filter(agent => {
        const matchEq = !eqFilter || agent.Equipe === eqFilter;
        const matchSt = !stFilter || agent.Statut === stFilter;
        const textToSearch = `${agent.Nom} ${agent.Prenom} ${agent.Matricule || ''}`.toLowerCase();
        const matchSearch = !searchFilter || textToSearch.includes(searchFilter);
        return matchEq && matchSt && matchSearch;
    });

    document.getElementById('agent-count-badge').textContent = `${agentsFiltres.length} agent(s)`;

    if (agentsFiltres.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Aucun agent trouvé</td></tr>';
        return;
    }

    agentsFiltres.forEach(agent => {
        const id = agent.Matricule || agent.ID || (agent.Nom + '_' + agent.Prenom);
        const isSelected = selectedAgentIds.has(id);
        const isCompatible = agent._isCompatible !== false; // Par défaut compatible

        // Calcul des totaux d'heures réalisées
        const totaux = calculerTotauxAgent(id);

        const tr = document.createElement('tr');
        if (isSelected) tr.classList.add('selected-row');
        if (!isCompatible) tr.classList.add('disabled-row');

        tr.innerHTML = `
            <td><input type="checkbox" class="chk-agent" value="${id}" ${isSelected ? 'checked' : ''} ${!isCompatible ? 'disabled' : ''}></td>
            <td class="col-sticky"><strong>${agent.Nom}</strong> ${agent.Prenom}</td>
            <td>${agent.Equipe || '-'}</td>
            <td><span class="badge-tag badge-statut">${agent.Statut || '-'}</span></td>
            <td><span class="${totaux.socle >= 16 ? 'fma-done' : 'fma-partial'}">${totaux.socle} h</span></td>
            <td><span class="${totaux.specialites >= 8 ? 'fma-done' : 'fma-partial'}">${totaux.specialites} h</span></td>
            <td><strong>${totaux.socle} h</strong></td>
            <td><strong>${totaux.specialites} h</strong></td>
        `;

        // Interaction avec la case à cocher
        const chk = tr.querySelector('.chk-agent');
        chk.addEventListener('change', (e) => toggleAgentSelection(id, e.target.checked, tr));

        tbody.appendChild(tr);
    });

    mettreAJourStatusSelection();
}

function calculerTotauxAgent(agentId) {
    let socle = 0;
    let specialites = 0;

    const saisiesAgent = suiviHistorique.filter(s => s.Matricule === agentId || s.AgentID === agentId);
    saisiesAgent.forEach(s => {
        const duree = parseFloat(s.Duree) || 0;
        if (s.TypeDomaine === 'Spécialité') {
            specialites += duree;
        } else {
            socle += duree;
        }
    });

    return { socle: socle.toFixed(1), specialites: specialites.toFixed(1) };
}

// --- SELECTION DES AGENTS ---
function toggleAgentSelection(id, checked, trElement) {
    if (checked) {
        selectedAgentIds.add(id);
        trElement.classList.add('selected-row');
    } else {
        selectedAgentIds.delete(id);
        trElement.classList.remove('selected-row');
    }
    mettreAJourStatusSelection();
}

function toutSelectionner(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('.chk-agent:not(:disabled)');

    checkboxes.forEach(chk => {
        chk.checked = isChecked;
        const tr = chk.closest('tr');
        const id = chk.value;
        if (isChecked) {
            selectedAgentIds.add(id);
            tr.classList.add('selected-row');
        } else {
            selectedAgentIds.delete(id);
            tr.classList.remove('selected-row');
        }
    });

    mettreAJourStatusSelection();
}

function mettreAJourStatusSelection() {
    const statusText = document.getElementById('selection-status');
    if (statusText) {
        statusText.textContent = `👥 ${selectedAgentIds.size} agent(s) sélectionné(s)`;
    }
    actualiserEtatBoutonValidation();
}

function actualiserEtatBoutonValidation() {
    const btnValider = document.getElementById('btn-valider-groupe');
    const themeSelect = document.getElementById('saisie-theme').value;
    if (btnValider) {
        btnValider.disabled = (selectedAgentIds.size === 0 || !themeSelect);
    }
}

// --- RÈGLE MÉTIER : VERROUILLAGE AGENTS NON CONCERNÉS ---
function recalculerCompatibiliteAgents(formation) {
    agentsData.forEach(agent => {
        if (!formation) {
            agent._isCompatible = true;
        } else {
            const quotaRequis = agent[formation.Theme] || agent['Quota_' + formation.Domaine];
            agent._isCompatible = (quotaRequis !== '0' && quotaRequis !== 0);
        }
    });
    afficherTableauAgents();
}

// --- RÈGLE MÉTIER : CONTRÔLE DE CHEVAUCHEMENT HORAIRE ---
function verifierChevauchements(agentId, date, hDebut, hFin) {
    const saisiesAgentDate = suiviHistorique.filter(s => 
        (s.Matricule === agentId || s.AgentID === agentId) && s.Date_Formation === date
    );

    for (let s of saisiesAgentDate) {
        if (horairesSeChevauchent(hDebut, hFin, s.Heure_Debut, s.Heure_Fin)) {
            return s; // Renvoie la saisie existante qui fait conflit
        }
    }
    return null;
}

function horairesSeChevauchent(start1, end1, start2, end2) {
    return (start1 < end2) && (end1 > start2);
}

// --- VALIDATION DE LA SAISIE GROUPEE ---
function validerSaisieGroupee(e) {
    e.preventDefault();

    if (selectedAgentIds.size === 0) {
        alert("Veuillez sélectionner au moins un agent.");
        return;
    }

    const dateFormation = document.getElementById('saisie-date').value;
    const hDebut = document.getElementById('saisie-heure-debut').value;
    const hFin = document.getElementById('saisie-heure-fin').value;
    const duree = calculerDuree();
    const domaine = document.getElementById('saisie-activite').value;
    const theme = document.getElementById('saisie-theme').value;
    const formateur = document.getElementById('saisie-formateur').value;
    const commentaires = document.getElementById('saisie-commentaires').value;
    const dateSaisie = new Date().toISOString().split('T')[0];

    let enregistrementsAjoutes = 0;
    let conflits = [];

    selectedAgentIds.forEach(agentId => {
        const agent = agentsData.find(a => (a.Matricule || a.ID || (a.Nom + '_' + a.Prenom)) === agentId);
        
        // Vérification anti-chevauchement
        const conflit = verifierChevauchements(agentId, dateFormation, hDebut, hFin);
        if (conflit) {
            conflits.push(`${agent.Nom} ${agent.Prenom} (conflit avec ${conflit.Theme} de ${conflit.Heure_Debut} à ${conflit.Heure_Fin})`);
            return;
        }

        // Création de la ligne d'historique
        const nouvelleSaisie = {
            Date_Saisie: dateSaisie,
            Matricule: agentId,
            Nom: agent ? agent.Nom : '',
            Prenom: agent ? agent.Prenom : '',
            Equipe: agent ? agent.Equipe : '',
            Date_Formation: dateFormation,
            Heure_Debut: hDebut,
            Heure_Fin: hFin,
            Duree: duree,
            TypeDomaine: domaine,
            Theme: theme,
            Formateur: formateur,
            Commentaires: commentaires
        };

        suiviHistorique.push(nouvelleSaisie);
        enregistrementsAjoutes++;
    });

    if (conflits.length > 0) {
        alert(`Attention, chevauchement d'horaires détecté pour certains agents :\n\n- ${conflits.join('\n- ')}\n\nCes agents n'ont pas été ajoutés.`);
    }

    if (enregistrementsAjoutes > 0) {
        alert(`✅ ${enregistrementsAjoutes} saisie(s) enregistrée(s) avec succès !`);
        afficherTableauAgents();
    }
}

// --- EXPORTATION CSV (AVEC DATE DE SAISIE) ---
function exporterSuiviCSV() {
    if (suiviHistorique.length === 0) {
        alert("Aucun suivi à exporter.");
        return;
    }

    const headers = [
        "Date_Saisie", "Matricule", "Nom", "Prenom", "Equipe", 
        "Date_Formation", "Heure_Debut", "Heure_Fin", "Duree", 
        "TypeDomaine", "Theme", "Formateur", "Commentaires"
    ];

    let csvLines = [headers.join(';')];

    suiviHistorique.forEach(row => {
        const line = headers.map(header => {
            let val = row[header] !== undefined ? String(row[header]) : '';
            if (val.includes(';') || val.includes('"') || val.includes('\n')) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(';');
        csvLines.push(line);
    });

    const csvContent = "\uFEFF" + csvLines.join('\n'); // UTF-8 BOM pour Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `suivi_fmpa_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
