// Structure de stockage 100% en mémoire (sans localStorage)
let tableauAgentsRH = [];
let historiqueSaisiesFMPA = []; // Stocke l'historique de chaque session
let cumulHeuresParAgent = {};   // Cumul par { agentId: { formationId: totalHeures } }
let agentsSelectionnes = new Set();

document.addEventListener("DOMContentLoaded", () => {
    // Forcer le nettoyage du cache local pour le catalogue
    localStorage.removeItem("catalogueFormations");

    // 1. Initialiser les listes déroulantes du catalogue
    initialiserFiltresEtListes();

    // 2. Initialiser la date du jour
    const dateInput = document.getElementById("saisie-date");
    if (dateInput) dateInput.valueAsDate = new Date();

    // 3. Message initial dans le tableau
    afficherMessageAccueil();

    // 4. Gestionnaires d'événements Import / Export CSV
    const btnImport = document.getElementById("btn-import-csv");
    const fileInput = document.getElementById("file-input-csv");
    if (btnImport && fileInput) {
        btnImport.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", importerCSVManuel);
    }

    const btnExport = document.getElementById("btn-export-csv");
    if (btnExport) {
        btnExport.addEventListener("click", exporterSuiviCSV);
    }

    // Filtres du tableau
    document.getElementById("filter-equipe").addEventListener("change", filtrerEtAfficherTableau);
    
    const filterStatut = document.getElementById("filter-statut");
    if (filterStatut) filterStatut.addEventListener("change", filtrerEtAfficherTableau);

    document.getElementById("filter-search").addEventListener("input", filtrerEtAfficherTableau);
    document.getElementById("btn-reset-filters").addEventListener("click", reinitialiserFiltres);

    // Formulaire de saisie
    document.getElementById("saisie-heure-debut").addEventListener("change", calculerDuree);
    document.getElementById("saisie-heure-fin").addEventListener("change", calculerDuree);
    document.getElementById("saisie-activite").addEventListener("change", majListeThemes);
    document.getElementById("select-all").addEventListener("change", basculerToutSelectionner);
    document.getElementById("form-saisie-groupee").addEventListener("submit", validerSaisieGroupee);

    calculerDuree();
});

/**
 * Affiche l'invitation à importer le CSV au démarrage
 */
function afficherMessageAccueil() {
    const tbody = document.getElementById("tbody-agents");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">
                    <div style="font-size: 1.1rem; margin-bottom: 8px;"><strong>Aucune liste d'agents chargée</strong></div>
                    Veuillez cliquer sur le bouton <strong>"📂 Importer baseAgents.csv"</strong> ci-dessus pour charger votre fichier réseau.
                </td>
            </tr>`;
    }
}

/**
 * Importation et lecture manuelle du fichier CSV des agents
 */
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
        alimenterSelectFiltres();
        initialiserFiltresEtListes();
        filtrerEtAfficherTableau();
    } else {
        alert("Aucun agent n'a pu être extrait du fichier CSV. Vérifiez le format du fichier.");
    }
}

/**
 * Parsing brut du CSV issu d'Excel avec nettoyage automatique des guillemets
 */
function parseCSVAgentsBrut(texteCSV) {
    const lignes = texteCSV.split(/\r\n|\n/).filter(l => l.trim() !== "");
    if (lignes.length < 2) return [];

    const enTeteBrute = lignes[0];
    const separateur = enTeteBrute.includes(";") ? ";" : ",";
    
    // Suppression des guillemets, espaces et du BOM UTF-8 éventuel dans les en-têtes
    const entetes = enTeteBrute
        .replace(/^\ufeff/, '')
        .split(separateur)
        .map(h => h.replace(/"/g, '').trim().toLowerCase());

    const resultats = [];

    // Regex pour découper en tenant compte des valeurs entre guillemets
    const regexSeparateur = new RegExp(`${separateur}(?=(?:(?:[^"]*"){2})*[^"]*$)`);

    for (let i = 1; i < lignes.length; i++) {
        const valeurs = lignes[i]
            .split(regexSeparateur)
            .map(v => v.replace(/^"|"$/g, '').trim());

        if (valeurs.length < entetes.length) continue;

        const ligneObj = {};
        entetes.forEach((cle, idx) => {
            ligneObj[cle] = valeurs[idx] || "";
        });

    // --- SOLUTION : Ignorer les PATS ---
    const statut = (ligneObj["statut"] || "").toUpperCase();
    if (statut === "PATS") continue;
    // ------------------------------------

        
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
            specialites: ligneObj["specialites"] 
                ? ligneObj["specialites"].split(/[,/;]/).map(s => s.trim()).filter(Boolean) 
                : [],
            competences: ligneObj["competences"] 
                ? ligneObj["competences"].split(/[,/;]/).map(c => c.trim()).filter(Boolean) 
                : [],
            engagement: ligneObj["engagement"] || "",
            regime: ligneObj["regime"] || ""
        });
    }

    return resultats;
}

/**
 * Alimentation dynamique des filtres Équipe et Statut
 */
function alimenterSelectFiltres() {
    // 1. Filtre Équipes
    const selectEquipe = document.getElementById("filter-equipe");
    if (selectEquipe) {
        selectEquipe.innerHTML = '<option value="">Toutes</option>';
        const equipes = [...new Set(tableauAgentsRH.map(a => a.equipe).filter(Boolean))].sort();
        equipes.forEach(eq => {
            const opt = document.createElement("option");
            opt.value = eq;
            opt.textContent = eq;
            selectEquipe.appendChild(opt);
        });
    }

    // 2. Filtre Statuts (SPP, SPV, PATS, etc.)
    const selectStatut = document.getElementById("filter-statut");
    if (selectStatut) {
        selectStatut.innerHTML = '<option value="">Tous</option>';
        const statuts = [...new Set(tableauAgentsRH.map(a => a.statut).filter(Boolean))].sort();
        statuts.forEach(st => {
            const opt = document.createElement("option");
            opt.value = st;
            opt.textContent = st;
            selectStatut.appendChild(opt);
        });
    }
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
            const gradeStr = agent.grade ? `${agent.grade} ` : '';
            opt.value = `${gradeStr}${agent.nom} ${agent.prenom}`;
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
    const statutFiltre = document.getElementById("filter-statut") ? document.getElementById("filter-statut").value : "";
    const recherche = document.getElementById("filter-search").value.toLowerCase().trim();

    const agentsFiltres = tableauAgentsRH.filter(agent => {
        const matchEquipe = !equipeFiltre || agent.equipe === equipeFiltre;
        const matchStatut = !statutFiltre || agent.statut === statutFiltre;
        const terme = `${agent.nom} ${agent.prenom} ${agent.matricule} ${agent.grade} ${agent.fonction}`.toLowerCase();
        const matchRecherche = !recherche || terme.includes(recherche);
        
        return matchEquipe && matchStatut && matchRecherche;
    });

    agentsFiltres.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));

    afficherTableauAgents(agentsFiltres);
}

function reinitialiserFiltres() {
    document.getElementById("filter-equipe").value = "";
    if (document.getElementById("filter-statut")) document.getElementById("filter-statut").value = "";
    document.getElementById("filter-search").value = "";
    filtrerEtAfficherTableau();
}

function afficherTableauAgents(listeAgents) {
    const tbody = document.getElementById("tbody-agents");
    tbody.innerHTML = "";

    if (listeAgents.length === 0) {
        // Passé de colspan="5" à colspan="6" pour couvrir la nouvelle colonne
        tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Aucun agent à afficher.</td></tr>';
        document.getElementById("count-badge").textContent = `0 / ${tableauAgentsRH.length} agent(s)`;
        majStatutSelection();
        return;
    }

    listeAgents.forEach(agent => {
        const idAgent = agent.id;
        const isChecked = agentsSelectionnes.has(idAgent) ? "checked" : "";
        const avancementSocleHtml = genererAvancementSocle(agent);
        const avancementSpecHtml = genererAvancementSpecialites(agent); // Calcul de la nouvelle colonne

        const tr = document.createElement("tr");
        if (isChecked) tr.classList.add("selected-row");

        const gradeStr = agent.grade ? `${agent.grade} ` : '';
        const fonctionStr = agent.fonction ? ` (${agent.fonction})` : '';
        const agentLibelle = `${gradeStr}<strong>${agent.nom}</strong> ${agent.prenom}${fonctionStr}`;

        tr.innerHTML = `
            <td>
                <input type="checkbox" class="chk-agent" value="${idAgent}" ${isChecked} onchange="toggleAgent('${idAgent}')">
            </td>
            <td>
                ${agentLibelle}
            </td>
            <td>${agent.equipe}</td>
            <td>
                <span class="badge-tag badge-statut">${agent.statut || '-'}</span>
            </td>
            <td><small>${avancementSocleHtml}</small></td>
            <td><small>${avancementSpecHtml}</small></td>
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

    const extraireValeurs = (champ) => {
        if (!champ) return [];
        if (Array.isArray(champ)) return champ.map(v => v.toString().trim().toUpperCase());
        return champ.toString().split(/[,/;]/).map(v => v.trim().toUpperCase());
    };

    const tousLesProfilsAgent = new Set([
        ...extraireValeurs(agent.statut),
        ...extraireValeurs(agent.grade),
        ...extraireValeurs(agent.fonction),
        ...extraireValeurs(agent.specialites),
        ...extraireValeurs(agent.competences),
        ...extraireValeurs(agent.engagement),
        ...extraireValeurs(agent.regime)
    ]);

    return socleFormations.map(f => {
        let quotaRequis = f.quota;

        if (f.modulations && Array.isArray(f.modulations) && f.modulations.length > 0) {
            const mod = f.modulations.find(m => 
                m.profil && tousLesProfilsAgent.has(m.profil.trim().toUpperCase())
            );

            if (mod !== undefined) {
                quotaRequis = Number(mod.quota);
            }
        } 
        else if (f.dispenses && Array.isArray(f.dispenses)) {
            const isDispense = f.dispenses.some(d => 
                tousLesProfilsAgent.has(d.trim().toUpperCase())
            );
            if (isDispense) quotaRequis = 0;
        }

        if (quotaRequis === 0) {
            return null; 
        }

        const fait = heuresAgent[f.id] || 0;

        let styleClass = "fma-todo";
        if (fait >= quotaRequis) styleClass = "fma-done";
        else if (fait > 0) styleClass = "fma-partial";

        // L'intitulé reste en noir/sombre (#0f172a), bleu foncé (#1e40af), bleu discret (#334155); seule la valeur conserve la classe de couleur
        return `<span style="color: #1e40af; font-size: 1.1em; font-weight: 640;">${f.libelle} :</span> <span class="${styleClass}">${fait}/${quotaRequis}h</span>`;
    })
    .filter(Boolean)
    .join(" | ") || "<span style='color:#64748b;'>Aucun socle requis</span>";
}

function genererAvancementSpecialites(agent) {
    if (typeof catalogueInitial === 'undefined') return "Catalogue non chargé";

    // 1. Spécialités brutes (ex: ["SAV 1", "IMP"])
    const specAgentBrutes = (agent.specialites || []).map(s => s.trim().toUpperCase()).filter(Boolean);

    if (specAgentBrutes.length === 0) {
        return "<span style='color:#94a3b8;'>Aucune spél.</span>";
    }

    // 2. Extraire la version "sans niveau" (ex: "SAV 1" -> "SAV")
    const specAgentBase = specAgentBrutes.map(s => s.replace(/\s*\d+$/, ''));

    const idAgent = agent.id;
    const heuresAgent = cumulHeuresParAgent[idAgent] || {};

    // 3. Filtrer le catalogue
    const formationsSpec = catalogueInitial.filter(f => {
        const typeF = (f.type || "").toUpperCase();
        const estTypeSpec = typeF.includes("SPEC") || typeF.includes("SPÉCIALITÉ");

        if (!estTypeSpec) return false;

        const activiteF = (f.activite || f.Activité || "").trim().toUpperCase();
        const profilF = (f.profil || f.Profil || "").trim().toUpperCase();

        // Cas A : Le catalogue spécifie un profil avec niveau (ex: profil = "SAV 1")
        if (profilF && profilF !== "TOUS") {
            return specAgentBrutes.includes(profilF);
        }

        // Cas B : Pas de profil spécifique -> la simple présence de l'activité suffit (ex: activite = "SAV")
        if (activiteF) {
            return specAgentBase.includes(activiteF);
        }

        return false;
    });

    if (formationsSpec.length === 0) {
        return "<span style='color:#94a3b8;'>Aucun suivi requis</span>";
    }

    // 4. Génération du rendu des badges
    return formationsSpec.map(f => {
        const quotaRequis = Number(f.quota) || 0;
        if (quotaRequis === 0) return null;

        const fait = heuresAgent[f.id] || 0;

        let styleClass = "fma-todo";
        if (fait >= quotaRequis) styleClass = "fma-done";
        else if (fait > 0) styleClass = "fma-partial";

        return `<span style="color: #0f172a; font-weight: 500;">${f.libelle} :</span> <span class="${styleClass}">${fait}/${quotaRequis}h</span>`;
    })
    .filter(Boolean)
    .join(" | ") || "<span style='color:#64748b;'>0/0h</span>";
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

    agentsSelectionnes.forEach(idAgent => {
        const agent = tableauAgentsRH.find(a => a.id === idAgent);
        if (!agent) return;

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

        if (!cumulHeuresParAgent[idAgent]) cumulHeuresParAgent[idAgent] = {};
        const heuresActuelles = cumulHeuresParAgent[idAgent][idFormation] || 0;
        cumulHeuresParAgent[idAgent][idFormation] = heuresActuelles + duree;
    });

    alert(`Saisie enregistrée avec succès !\n${duree}h ajoutée(s) pour ${agentsSelectionnes.size} agent(s).`);

    agentsSelectionnes.clear();
    document.getElementById("select-all").checked = false;
    filtrerEtAfficherTableau();
}

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
