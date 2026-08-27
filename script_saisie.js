// Structure de stockage 100% en mémoire (sans localStorage)
let tableauAgentsRH = [];
let historiqueSaisiesFMPA = []; // Stocke l'historique de chaque session
let cumulHeuresParAgent = {};   // Cumul par { agentId: { formationId: totalHeures } }
let agentsSelectionnes = new Set();

document.addEventListener("DOMContentLoaded", () => {
    // 1. Alimenter immédiatement le formulaire depuis donnees_catalogue.js
    initialiserFiltresEtListes();

    // 2. Initialiser la date du jour
    const elDate = document.getElementById("saisie-date");
    if (elDate) elDate.valueAsDate = new Date();
    // 3. Appel automatique du fichier baseAgents.csv du même dossier
    chargerCSVAutomatique();

    // 4. Initialiser la date du jour
    const elDate = document.getElementById("saisie-date");
    if (elDate) elDate.valueAsDate = new Date();

    // 5. Importation manuelle du CSV si besoin
    const btnImport = document.getElementById("btn-import-csv");
    const fileInput = document.getElementById("file-input-csv");
    if (btnImport && fileInput) {
        btnImport.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", importerCSVManuel);
    }

    // 6. Exportation du CSV de suivi
    const btnExport = document.getElementById("btn-export-csv");
    if (btnExport) {
        btnExport.addEventListener("click", exporterSuiviCSV);
    }

    // Filtres
    document.getElementById("filter-equipe").addEventListener("change", filtrerEtAfficherTableau);
    document.getElementById("filter-search").addEventListener("input", filtrerEtAfficherTableau);
    document.getElementById("btn-reset-filters").addEventListener("click", reinitialiserFiltres);

    // Calcul de durée
    document.getElementById("saisie-heure-debut").addEventListener("change", calculerDuree);
    document.getElementById("saisie-heure-fin").addEventListener("change", calculerDuree);

    // Liste déroulante dynamique Activité -> Thème
    document.getElementById("saisie-activite").addEventListener("change", majListeThemes);

    // Sélection globale
    document.getElementById("select-all").addEventListener("change", basculerToutSelectionner);

    // Soumission du formulaire
    document.getElementById("form-saisie-groupee").addEventListener("submit", validerSaisieGroupee);

    initialiserFiltresEtListes();
    calculerDuree();
});

/**
 * Appel direct au fichier baseAgents.csv via fetch()
 */
function chargerCSVAutomatique() {
    fetch("baseAgents.csv")
        .then(response => {
            if (!response.ok) throw new Error("Fichier non disponible par fetch");
            return response.text();
        })
        .then(contenu => {
            traiterContenuCSV(contenu);
        })
        .catch(() => {
            // Message si exécuté sans serveur local (file://)
            const tbody = document.getElementById("tbody-agents");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">
                    Veuillez importer le fichier via le bouton <strong>"📂 Importer baseAgents.csv"</strong>.
                </td></tr>`;
            }
        });
}

function importerCSVManuel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => traiterContenuCSV(evt.target.result);
    reader.readAsText(file, "UTF-8");
}

function traiterContenuCSV(texteCSV) {
    tableauAgentsRH = parseCSVAgentsBrut(texteCSV);

    if (tableauAgentsRH.length > 0) {
        alimenterSelectEquipes();
        initialiserFiltresEtListes();
        filtrerEtAfficherTableau();
    } else {
        alert("Aucun agent n'a pu être extrait du fichier CSV.");
    }
}

/**
/**
 * Lit le fichier baseAgents.csv et nettoie les guillemets
 */
function parseCSVAgentsBrut(texteCSV) {
    const lignes = texteCSV.split(/\r\n|\n/).filter(l => l.trim() !== "");
    if (lignes.length < 2) return [];

    const enTeteBrute = lignes[0];
    const separateur = enTeteBrute.includes(";") ? ";" : ",";
    
    // Nettoyage des en-têtes (suppression des guillemets et espaces)
    const entetes = enTeteBrute.split(separateur).map(h => h.replace(/"/g, '').trim().toLowerCase());

    const resultats = [];

    for (let i = 1; i < lignes.length; i++) {
        // Nettoyage de chaque valeur (suppression des guillemets encadrants)
        const valeurs = lignes[i].split(separateur).map(v => v.replace(/"/g, '').trim());
        if (valeurs.length < entetes.length) continue;

        const ligneObj = {};
        entetes.forEach((cle, idx) => {
            ligneObj[cle] = valeurs[idx] || "";
        });

        const matricule = ligneObj["matricule"] || `AG-${i}`;
        resultats.push({
            id: matricule,
            matricule: matricule,
            sexe: ligneObj["sexe"] || "",
            nom: (ligneObj["nom"] || "").toUpperCase(),
            prenom: ligneObj["prenom"] || "",
            equipe: ligneObj["equipe"] || "Non affecté",
            statut: ligneObj["statut"] || "",
            grade: ligneObj["grade"] || "",
            fonction: ligneObj["fonction"] || "",
            specialites: ligneObj["specialites"] ? ligneObj["specialites"].split(/[,/]/).map(s => s.trim()) : []
        });
    }

    return resultats;
}

function alimenterSelectEquipes() {
    const selectEquipe = document.getElementById("filter-equipe");
    if (!selectEquipe) return;

    selectEquipe.innerHTML = '<option value="">Toutes</option>';

    const equipes = [...new Set(tableauAgentsRH.map(a => a.equipe).filter(Boolean))].sort();
    equipes.forEach(eq => {
        const opt = document.createElement("option");
        opt.value = eq;
        opt.textContent = eq;
        selectEquipe.appendChild(opt);
    });
}

function initialiserFiltresEtListes() {
    const selectAct = document.getElementById("saisie-activite");
    if (selectAct && typeof catalogueInitial !== 'undefined') {
        selectAct.innerHTML = '<option value="">-- Choisir un domaine --</option>';
        const activites = [...new Set(catalogueInitial.map(item => item.activite))].sort();

        activites.forEach(act => {
            const opt = document.createElement("option");
            opt.value = act;
            opt.textContent = act;
            selectAct.appendChild(opt);
        });
    }

    const datalistFormateurs = document.getElementById("liste-formateurs");
    if (datalistFormateurs) {
        datalistFormateurs.innerHTML = "";
        tableauAgentsRH.forEach(agent => {
            const opt = document.createElement("option");
            opt.value = `${agent.nom} ${agent.prenom}`;
            datalistFormateurs.appendChild(opt);
        });
    }
}

function majListeThemes() {
    const activite = document.getElementById("saisie-activite").value;
    const selectTheme = document.getElementById("saisie-theme");

    selectTheme.innerHTML = '<option value="">-- Choisir une formation --</option>';

    if (!activite || typeof catalogueInitial === 'undefined') {
        selectTheme.disabled = true;
        return;
    }

    const formations = catalogueInitial.filter(f => f.activite === activite);
    formations.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = `${f.libelle} (${f.quota}h)`;
        selectTheme.appendChild(opt);
    });

    selectTheme.disabled = false;
}

function calculerDuree() {
    const debut = document.getElementById("saisie-heure-debut").value;
    const fin = document.getElementById("saisie-heure-fin").value;
    const display = document.getElementById("duree-calculee");

    if (!debut || !fin) {
        display.textContent = "0.0 h";
        return 0;
    }

    const [hD, mD] = debut.split(':').map(Number);
    const [hF, mF] = fin.split(':').map(Number);

    let minutesTotal = (hF * 60 + mF) - (hD * 60 + mD);
    if (minutesTotal < 0) minutesTotal += 24 * 60;

    const heures = (minutesTotal / 60).toFixed(1);
    display.textContent = `${heures} h`;
    return parseFloat(heures);
}

function filtrerEtAfficherTableau() {
    const equipeFiltre = document.getElementById("filter-equipe").value;
    const recherche = document.getElementById("filter-search").value.toLowerCase().trim();

    const agentsFiltres = tableauAgentsRH.filter(agent => {
        const matchEquipe = !equipeFiltre || agent.equipe === equipeFiltre;
        const terme = `${agent.nom} ${agent.prenom} ${agent.matricule} ${agent.grade} ${agent.fonction}`.toLowerCase();
        const matchRecherche = !recherche || terme.includes(recherche);
        return matchEquipe && matchRecherche;
    });

    agentsFiltres.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));

    afficherTableauAgents(agentsFiltres);
}

function reinitialiserFiltres() {
    document.getElementById("filter-equipe").value = "";
    document.getElementById("filter-search").value = "";
    filtrerEtAfficherTableau();
}

function afficherTableauAgents(listeAgents) {
    const tbody = document.getElementById("tbody-agents");
    tbody.innerHTML = "";

    if (listeAgents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Aucun agent à afficher.</td></tr>';
        document.getElementById("count-badge").textContent = `0 / ${tableauAgentsRH.length} agent(s)`;
        majStatutSelection();
        return;
    }

    listeAgents.forEach(agent => {
        const idAgent = agent.id;
        const isChecked = agentsSelectionnes.has(idAgent) ? "checked" : "";
        const avancementHtml = genererAvancementSocle(agent);

        const tr = document.createElement("tr");
        if (isChecked) tr.classList.add("selected-row");

        tr.innerHTML = `
            <td>
                <input type="checkbox" class="chk-agent" value="${idAgent}" ${isChecked} onchange="toggleAgent('${idAgent}')">
            </td>
            <td>
                <strong>${agent.nom}</strong> ${agent.prenom}
                <div style="font-size: 0.75rem; color: #64748b;">Matricule: ${agent.matricule}</div>
            </td>
            <td>${agent.equipe}</td>
            <td>
                <span class="badge-tag badge-statut">${agent.statut || 'SPP'}</span>
                <span class="badge-tag badge-grade">${agent.grade || '-'}</span>
                ${agent.fonction ? `<span class="badge-tag badge-fonction">${agent.fonction}</span>` : ''}
            </td>
            <td><small>${avancementHtml}</small></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("count-badge").textContent = `${listeAgents.length} / ${tableauAgentsRH.length} agent(s)`;
    majStatutSelection();
}

function genererAvancementSocle(agent) {
    if (typeof catalogueInitial === 'undefined') return "Catalogue non chargé";

    const idAgent = agent.id;
    const heuresAgent = cumulHeuresParAgent[idAgent] || {};

    const socleFormations = catalogueInitial.filter(f => f.type === "Socle Commun");

    return socleFormations.map(f => {
        let quotaRequis = f.quota;

        if (f.modulations && f.modulations.length > 0 && agent.fonction) {
            const mod = f.modulations.find(m => m.profil.trim().toUpperCase() === agent.fonction.trim().toUpperCase());
            if (mod !== undefined) quotaRequis = mod.quota;
        }

        const fait = heuresAgent[f.id] || 0;

        let styleClass = "fma-todo";
        if (fait >= quotaRequis) styleClass = "fma-done";
        else if (fait > 0) styleClass = "fma-partial";

        return `<span class="${styleClass}">${f.libelle}: ${fait}/${quotaRequis}h</span>`;
    }).join(" | ");
}

function toggleAgent(idAgent) {
    if (agentsSelectionnes.has(idAgent)) {
        agentsSelectionnes.delete(idAgent);
    } else {
        agentsSelectionnes.add(idAgent);
    }
    filtrerEtAfficherTableau();
}

function basculerToutSelectionner(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll(".chk-agent");

    agentsSelectionnes.clear();
    checkboxes.forEach(chk => {
        chk.checked = isChecked;
        if (isChecked) agentsSelectionnes.add(chk.value);
    });

    filtrerEtAfficherTableau();
}

function majStatutSelection() {
    const count = agentsSelectionnes.size;
    document.getElementById("selection-status").textContent = `👥 ${count} agent(s) sélectionné(s)`;
    document.getElementById("btn-valider-groupe").disabled = count === 0;
}

/**
 * Valide et enregistre la saisie dans l'historique en mémoire
 */
function validerSaisieGroupee(e) {
    e.preventDefault();

    const duree = calculerDuree();
    const dateSaisie = document.getElementById("saisie-date").value;
    const heureDebut = document.getElementById("saisie-heure-debut").value;
    const heureFin = document.getElementById("saisie-heure-fin").value;
    const idFormation = document.getElementById("saisie-theme").value;
    const formateur = document.getElementById("saisie-formateur").value;
    const lieu = document.getElementById("saisie-lieu").value;
    const commentaires = document.getElementById("saisie-commentaires").value;

    if (agentsSelectionnes.size === 0) {
        alert("Veuillez sélectionner au moins un agent.");
        return;
    }

    if (!idFormation || duree <= 0) {
        alert("Veuillez sélectionner une formation valide et renseigner la durée.");
        return;
    }

    const formationObj = catalogueInitial.find(f => f.id === idFormation);
    const libelleFormation = formationObj ? formationObj.libelle : idFormation;

    // Enregistrement des lignes d'historique et mise à jour des cumuls
    agentsSelectionnes.forEach(idAgent => {
        const agent = tableauAgentsRH.find(a => a.id === idAgent);
        if (!agent) return;

        // 1. Ajouter la ligne d'historique
        historiqueSaisiesFMPA.push({
            date: dateSaisie,
            matricule: agent.matricule,
            nom: agent.nom,
            prenom: agent.prenom,
            equipe: agent.equipe,
            formationId: idFormation,
            formationLibelle: libelleFormation,
            dureeHeures: duree,
            heureDebut: heureDebut,
            heureFin: heureFin,
            formateur: formateur,
            lieu: lieu,
            commentaires: commentaires
        });

        // 2. Mettre à jour le cumul
        if (!cumulHeuresParAgent[idAgent]) cumulHeuresParAgent[idAgent] = {};
        const heuresActuelles = cumulHeuresParAgent[idAgent][idFormation] || 0;
        cumulHeuresParAgent[idAgent][idFormation] = heuresActuelles + duree;
    });

    alert(`Saisie enregistrée avec succès !\n${duree}h ajoutée(s) pour ${agentsSelectionnes.size} agent(s).`);

    agentsSelectionnes.clear();
    document.getElementById("select-all").checked = false;
    filtrerEtAfficherTableau();
}

/**
 * Génère et télécharge le fichier CSV des saisies (suivi_formations_fmpa.csv)
 */
function exporterSuiviCSV() {
    if (historiqueSaisiesFMPA.length === 0) {
        alert("Aucune saisie n'a encore été effectuée pour cette session.");
        return;
    }

    let csvContent = "Date;Matricule;Nom;Prenom;Equipe;CodeFormation;Formation;DureeHeures;HeureDebut;HeureFin;Formateur;Lieu;Commentaires\n";

    historiqueSaisiesFMPA.forEach(row => {
        csvContent += `${row.date};${row.matricule};${row.nom};${row.prenom};${row.equipe};${row.formationId};"${row.formationLibelle}";${row.dureeHeures};${row.heureDebut};${row.heureFin};"${row.formateur}";"${row.lieu}";"${row.commentaires}"\n`;
    });

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `suivi_formations_fmpa_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
