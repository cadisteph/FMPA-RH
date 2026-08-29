// Variable globale contenant les données en mémoire vive
let baseAgents = [];
let catalogue = [];
let historiqueSuivi = []; // Démarre vide ou avec le suivi.csv importé

// 1. Initialisation des événements
document.addEventListener('DOMContentLoaded', () => {
    // Écouteurs sur les boutons d'import
    document.getElementById('btn-import-csv')?.addEventListener('click', () => document.getElementById('file-csv').click());
    document.getElementById('btn-import-catalogue')?.addEventListener('click', () => document.getElementById('file-cat').click());
    document.getElementById('btn-import-suivi')?.addEventListener('click', () => document.getElementById('file-suivi').click());

    document.getElementById('file-csv')?.addEventListener('change', (e) => chargerCSV(e.target.files[0], 'agents'));
    document.getElementById('file-cat')?.addEventListener('change', (e) => chargerCSV(e.target.files[0], 'catalogue'));
    document.getElementById('file-suivi')?.addEventListener('change', (e) => chargerCSV(e.target.files[0], 'suivi'));

    document.getElementById('btn-export-csv')?.addEventListener('click', exporterCSV);

    // Changement de domaine -> met à jour la liste des formations
    document.getElementById('form-domaine')?.addEventListener('change', majThemes);

    // Gestion de la case "Tout cocher"
    document.getElementById('chk-all')?.addEventListener('change', toggleAllCheckboxes);

    // Soumission du formulaire
    document.getElementById('form-saisie')?.addEventListener('submit', enregistrerSaisie);
});

// 2. Traitement et lecture des CSV
function chargerCSV(file, type) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return;
        
        const sep = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(sep).map(h => h.replace(/^["\ufeff]+|["\s]+$/g, '').trim());

        const data = lines.slice(1).map(l => {
            const vals = l.split(sep).map(v => v.replace(/^"|"$/g, '').trim());
            let obj = {};
            headers.forEach((h, i) => obj[h] = vals[i] || '');
            return obj;
        });

        if (type === 'agents') {
            baseAgents = data;
        } else if (type === 'catalogue') {
            catalogue = data;
            initDomaines();
        } else if (type === 'suivi') {
            historiqueSuivi = data;
        }

        rafraichirTableau();
    };
    reader.readAsText(file, 'UTF-8');
}

// 3. Remplissage dynamique des menus déroulants (Domaines & Thèmes)
function initDomaines() {
    const selDom = document.getElementById('form-domaine');
    if (!selDom) return;
    selDom.innerHTML = '<option value="">-- Choisir Domaine --</option>';
    
    const doms = [...new Set(catalogue.map(c => c.activite || c.fmpa).filter(Boolean))].sort();
    doms.forEach(d => {
        selDom.innerHTML += `<option value="${d}">${d}</option>`;
    });
}

function majThemes() {
    const dom = document.getElementById('form-domaine').value;
    const selTh = document.getElementById('form-theme');
    if (!selTh) return;
    
    selTh.innerHTML = '<option value="">-- Choisir Formation --</option>';
    if (!dom) { selTh.disabled = true; return; }

    const items = catalogue.filter(c => (c.activite || c.fmpa) === dom);
    items.forEach(i => {
        selTh.innerHTML += `<option value="${i.libelle || i.id}">${i.libelle} (${i.quota || 0}h)</option>`;
    });
    selTh.disabled = false;
}

// 4. Affichage du Tableau avec Détails "Fait / À faire"
function rafraichirTableau() {
    const tbody = document.getElementById('tbody-agents');
    if (!tbody) return;
    tbody.innerHTML = '';

    const statCount = document.getElementById('stat-count');
    if (statCount) statCount.textContent = `${baseAgents.length} Agent(s)`;

    if (!baseAgents.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Charger baseAgents.csv et catalogue.csv</td></tr>';
        return;
    }

    const socleCatalogue = catalogue.filter(c => c.type === 'Socle Commun');
    const speCatalogue = catalogue.filter(c => c.type === 'Spécialité');

    baseAgents.forEach((agent) => {
        const mat = agent.Matricule;
        const faitAgent = historiqueSuivi.filter(s => s.Matricule === mat);
        const libellesFaits = faitAgent.map(s => s.Formation);

        // --- DÉTAIL SOCLE ---
        let socleFait = [];
        let socleRestant = [];
        let totalH = 0;

        socleCatalogue.forEach(c => {
            const lib = c.libelle;
            if (libellesFaits.includes(lib)) {
                socleFait.push(lib);
                totalH += parseFloat(c.quota || 0);
            } else {
                socleRestant.push(lib);
            }
        });

        // --- DÉTAIL SPÉCIALITÉS ---
        const speAttribuees = (agent.Specialites || '').split(',').map(s => s.trim()).filter(Boolean);
        let speFait = [];
        let speRestant = [];
        let totalHSpe = 0;

        speCatalogue.forEach(c => {
            const lib = c.libelle;
            const dom = c.activite;
            const concerne = speAttribuees.some(s => s.startsWith(dom));
            
            if (concerne) {
                if (libellesFaits.includes(lib)) {
                    speFait.push(lib);
                    totalHSpe += parseFloat(c.quota || 0);
                } else {
                    speRestant.push(lib);
                }
            }
        });

        // Construction du HTML Socle
        let htmlSocle = '<div class="tag-list">';
        if (socleFait.length) htmlSocle += `<span class="tag tag-done"><b>Fait :</b> ${socleFait.join(', ')}</span>`;
        if (socleRestant.length) htmlSocle += `<span class="tag tag-todo"><b>À faire :</b> ${socleRestant.join(', ')}</span>`;
        if (!socleFait.length && !socleRestant.length) htmlSocle += '<em>Charger catalogue.csv</em>';
        htmlSocle += '</div>';

        // Construction du HTML Spécialités
        let htmlSpe = '<div class="tag-list">';
        if (!speAttribuees.length) {
            htmlSpe += '<em style="color:#999;">Aucune spé. attribuée</em>';
        } else {
            if (speFait.length) htmlSpe += `<span class="tag tag-done"><b>Fait :</b> ${speFait.join(', ')}</span>`;
            if (speRestant.length) htmlSpe += `<span class="tag tag-todo"><b>À faire :</b> ${speRestant.join(', ')}</span>`;
        }
        htmlSpe += '</div>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="chk-agent" data-mat="${mat}"></td>
            <td><b>${agent.Nom} ${agent.Prenom}</b><br><small style="color:#666;">${mat}</small></td>
            <td>${agent.Equipe || '-'}</td>
            <td>${htmlSocle}</td>
            <td>${htmlSpe}</td>
            <td><b>Socle :</b> ${totalH}h<br><b>Spé :</b> ${totalHSpe}h</td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.chk-agent').forEach(c => c.addEventListener('change', mefSelection));
}

// 5. Sélection et Enregistrement
function toggleAllCheckboxes() {
    const isChecked = this.checked;
    document.querySelectorAll('.chk-agent').forEach(c => c.checked = isChecked);
    mefSelection();
}

function mefSelection() {
    const n = document.querySelectorAll('.chk-agent:checked').length;
    const countSpan = document.getElementById('selected-count');
    const btnSubmit = document.getElementById('btn-submit');
    
    if (countSpan) countSpan.textContent = `${n} coché(s)`;
    if (btnSubmit) btnSubmit.disabled = (n === 0);
}

function enregistrerSaisie(e) {
    e.preventDefault(); // BLOQUE LE RECHARGEMENT DE PAGE DE SOURD !

    const dateVal = document.getElementById('form-date').value;
    const debutVal = document.getElementById('form-debut').value;
    const finVal = document.getElementById('form-fin').value;
    const themeVal = document.getElementById('form-theme').value;
    const formateurVal = document.getElementById('form-formateur').value;
    const comVal = document.getElementById('form-commentaires').value;

    const coches = document.querySelectorAll('.chk-agent:checked');

    coches.forEach(c => {
        const mat = c.dataset.mat;
        historiqueSuivi.push({
            Matricule: mat,
            Date: dateVal,
            HeureDebut: debutVal,
            HeureFin: finVal,
            Formation: themeVal,
            Formateur: formateurVal,
            Commentaires: comVal
        });
    });

    // Mettre à jour visuellement le tableau sans recharger
    rafraichirTableau();

    // Générer et télécharger le CSV mis à jour sur ton poste
    exporterCSV();

    // Message de confirmation
    const alertBox = document.getElementById('alert-msg');
    if (alertBox) {
        alertBox.style.display = 'block';
        setTimeout(() => alertBox.style.display = 'none', 3000);
    }
}

// 6. Exportation du fichier suivi.csv
function exporterCSV() {
    if (!historiqueSuivi.length) {
        alert("Aucune donnée de suivi à exporter.");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Matricule;Date;HeureDebut;HeureFin;Formation;Formateur;Commentaires\n";
    historiqueSuivi.forEach(row => {
        csvContent += `${row.Matricule};${row.Date};${row.HeureDebut};${row.HeureFin};"${row.Formation}";"${row.Formateur}";"${row.Commentaires}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `suivi.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
