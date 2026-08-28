// Structure de stockage 100% en mémoire (sans localStorage)
let catalogueInitial = [];          // Contient le catalogue extrait du CSV
let tableauAgentsRH = [];
let historiqueSaisiesFMPA = [];      // Stocke l'historique de chaque session
let cumulHeuresParAgent = {};        // Cumul par { agentId: { formationId: totalHeures } }
let agentsSelectionnes = new Set();

document.addEventListener("DOMContentLoaded", () => {
    // 1. Charger automatiquement le catalogue.csv (ou proposer l'import manuel)
    chargerCatalogueCSVAutomatique();

    // 2. Écouteurs pour l'import manuels si besoin
    const btnImportCat = document.getElementById("btn-import-catalogue");
    const fileInputCat = document.getElementById("file-input-catalogue");
    if (btnImportCat && fileInputCat) {
        btnImportCat.addEventListener("click", () => fileInputCat.click());
        fileInputCat.addEventListener("change", (e) => importerCSVManiereManuelle(e, traiterContenuCSVCatalogue));
    }

    const btnImportAgents = document.getElementById("btn-import-csv");
    const fileInputAgents = document.getElementById("file-input-csv");
    if (btnImportAgents && fileInputAgents) {
        btnImportAgents.addEventListener("click", () => fileInputAgents.click());
        fileInputAgents.addEventListener("change", (e) => importerCSVManiereManuelle(e, traiterContenuCSVAgents));
    }

    // 3. Initialiser la date du jour
    const dateInput = document.getElementById("saisie-date");
    if (dateInput) dateInput.valueAsDate = new Date();

    // 4. Message initial dans le tableau
    afficherMessageAccueil();

    // Export CSV
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
 * Tente de charger automatiquement `catalogue.csv` présent dans le même dossier
 */
function chargerCatalogueCSVAutomatique() {
    if (typeof Papa === 'undefined') {
        console.error("PapaParse n'est pas disponible.");
        return;
    }

    Papa.parse("catalogue.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (results.data && results.data.length > 0) {
                traiterDonneesCatalogue(results.data);
                console.log("Catalogue CSV chargé automatiquement avec succès.");
            }
        },
        error: function(err) {
            console.warn("Impossible de charger 'catalogue.csv' automatiquement, veuillez utiliser l'import manuel.", err);
        }
    });
}

/**
 * Gestion générique de la lecture de fichier CSV par FileReader
 */
function importerCSVManiereManuelle(e, callbackTraitement) {
    const file = e.target.files[0];
    if (!file) return;

    if (typeof Papa !== 'undefined') {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                callbackTraitement(results.data);
            }
        });
    } else {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const lines = evt.target.result.split(/\r\n|\n/);
            // Fallback rudimentaire si PapaParse n'est pas chargé
            alert("Veuillez vérifier que papaparse.min.js est bien incluse.");
        };
        reader.readAsText(file, "UTF-8");
    }
}

/**
 * Traitement des données extraites du catalogue.csv
 */
function traiterContenuCSVCatalogue(data) {
    traiterDonneesCatalogue(data);
    alert("Catalogue de formations mis à jour avec succès !");
}

function traiterDonneesCatalogue(dataObjets) {
    catalogueInitial = dataObjets.map((row, index) => {
        // Extraction flexible des entêtes (gère majuscules/minuscules et accents)
        const getVal = (cles) => {
            for (let c of cles) {
                const matchKey = Object.keys(row).find(k => k.trim().toLowerCase() === c.toLowerCase());
                if (matchKey && row[matchKey] !== undefined) return row[matchKey].trim();
            }
            return "";
        };

        const id = getVal(["id", "code", "reference"]) || `F-${index + 1}`;
        const libelle = getVal(["libelle", "titre", "formation", "nom"]) || "Formation sans titre";
        const activite = getVal(["activite", "domaine", "categorie"]) || "Général";
        const type = getVal(["type", "type_formation", "nature"]) || "Socle Commun";
        const quota = parseFloat(getVal(["quota", "volume_horaire", "heures"])) || 0;
        const profil = getVal(["profil", "specialite", "public"]) || "";

        // Traitement des modulations (ex: "SPP:24|SPV:12" ou au format JSON/texte)
        const modulationsRaw = getVal(["modulations", "modulation"]);
        let modulations = [];
        if (modulationsRaw) {
            try {
                if (modulationsRaw.startsWith("[")) {
                    modulations = JSON.parse(modulationsRaw);
                } else {
                    modulationsRaw.split("|").forEach(m => {
                        const [p, q] = m.split(":");
                        if (p && q) modulations.push({ profil: p.trim(), quota: parseFloat(q.trim()) });
                    });
                }
            } catch (e) {
                console.warn("Erreur parsing modulations pour", libelle, e);
            }
        }

        // Traitement des dispenses (ex: "PATS, SPV" séparés par virgules/semicolons)
        const dispensesRaw = getVal(["dispenses", "dispense"]);
        let dispenses = [];
        if (dispensesRaw) {
            dispenses = dispensesRaw.split(/[,/;|]/).map(d => d.trim()).filter(Boolean);
        }

        return {
            id: id,
            libelle: libelle,
            activite: activite,
            type: type,
            quota: quota,
            profil: profil,
            modulations: modulations,
            dispenses: dispenses
        };
    });

    initialiserFiltresEtListes();
    if (tableauAgentsRH.length > 0) {
        filtrerEtAfficherTableau();
    }
}

/**
 * Traitement des données extraites du fichier baseAgents.csv
 */
function traiterContenuCSVAgents(dataObjets) {
    tableauAgentsRH = [];

    dataObjets.forEach((row, i) => {
        const getVal = (cles) => {
            for (let c of cles) {
                const matchKey = Object.keys(row).find(k => k.trim().toLowerCase() === c.toLowerCase());
                if (matchKey && row[matchKey] !== undefined) return row[matchKey].trim();
            }
            return "";
        };

        const statut = getVal(["statut"]).toUpperCase();
        // Exclusion des PATS
        if (statut === "PATS") return;

        const matricule = getVal(["matricule", "id"]) || `AG-${i + 1}`;
        const specialitesStr = getVal(["specialites", "specialite"]);
        const competencesStr = getVal(["competences", "competence"]);

        tableauAgentsRH.push({
            id: matricule,
            matricule: matricule,
            sexe: getVal(["sexe"]),
            nom: getVal(["nom"]).toUpperCase(),
            prenom: getVal(["prenom"]),
            equipe: getVal(["equipe"]) || "Non affecté",
            statut: statut,
            grade: getVal(["grade"]),
            fonction: getVal(["fonction"]),
            specialites: specialitesStr ? specialitesStr.split(/[,/;]/).map(s => s.trim()).filter(Boolean) : [],
            competences: competencesStr ? competencesStr.split(/[,/;]/).map(c => c.trim()).filter(Boolean) : [],
            engagement: getVal(["engagement"]),
            regime: getVal(["regime"])
        });
    });

    if (tableauAgentsRH.length > 0) {
        alimenterSelectFiltres();
        initialiserFiltresEtListes();
        filtrerEtAfficherTableau();
    } else {
        alert("Aucun agent valide (hors PATS) n'a pu être extrait du fichier CSV.");
    }
}

/**
 * Message d'accueil tableau
 */
function afficherMessageAccueil() {
    const tbody = document.getElementById("tbody-agents");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
                    <div style="font-size: 1.1rem; margin-bottom: 8px;"><strong>Aucune liste d'agents chargée</strong></div>
                    Veuillez cliquer sur le bouton <strong>"📂 Importer baseAgents.csv"</strong> ci-dessus pour charger vos agents.
                </td>
            </tr>`;
    }
}

/**
 * Alimentation dynamique des filtres Équipe et Statut
 */
function alimenterSelectFiltres() {
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
    if (selectAct) {
        selectAct.innerHTML = catalogueInitial.length > 0 
            ? '<option value="">-- Choisir un domaine --</option>' 
            : '<option value="">-- Catalogue non chargé --</option>';

        if (catalogueInitial.length > 0) {
            selectAct.disabled = false;
            const activites = [...new Set(catalogueInitial.map(item => item.activite))].sort();
            activites.forEach(act => {
                const opt = document.createElement("option");
                opt.value = act;
                opt.textContent = act;
                selectAct.appendChild(opt);
            });
        }
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

    if (!activite || catalogueInitial.length === 0) {
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
        tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Aucun agent à afficher.</td></tr>';
        document.getElementById("count-badge").textContent = `0 / ${tableauAgentsRH.length} agent(s)`;
        majStatutSelection();
        return;
    }

    listeAgents.forEach(agent => {
        const idAgent = agent.id;
        const isChecked = agentsSelectionnes.has(idAgent) ? "checked" : "";
        const avancementSocleHtml = genererAvancementSocle(agent);
        const avancementSpecHtml = genererAvancementSpecialites(agent);

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
    if (catalogueInitial.length === 0) return "<span style='color:#94a3b8;'>Catalogue non chargé</span>";

    const idAgent = agent.id;
    const heuresAgent = cumulHeuresParAgent[idAgent] || {};
    const socleFormations = catalogueInitial.filter(f => f.type.toLowerCase().includes("socle"));

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

        return `<span style="color: #1e40af; font-size: 1.1em; font-weight: 640;">${f.libelle} :</span> <span class="${styleClass}">${fait}/${quotaRequis}h</span>`;
    })
    .filter(Boolean)
    .join(" | ") || "<span style='color:#64748b;'>Aucun socle requis</span>";
}

function genererAvancementSpecialites(agent) {
    if (catalogueInitial.length === 0) return "<span style='color:#94a3b8;'>Catalogue non chargé</span>";

    const specAgentBrutes = (agent.specialites || []).map(s => s.trim().toUpperCase()).filter(Boolean);

    if (specAgentBrutes.length === 0) {
        return "<span style='color:#94a3b8;'>Aucune spé.</span>";
    }

    const specAgentBase = specAgentBrutes.map(s => s.replace(/\s*\d+$/, ''));
    const idAgent = agent.id;
    const heuresAgent = cumulHeuresParAgent[idAgent] || {};

    const formationsSpec = catalogueInitial.filter(f => {
        const typeF = (f.type || "").toUpperCase();
        const estTypeSpec = typeF.includes("SPEC") || typeF.includes("SPÉCIALITÉ");

        if (!estTypeSpec) return false;

        const activiteF = (f.activite || "").trim().toUpperCase();
        const profilF = (f.profil || "").trim().toUpperCase();

        if (profilF && profilF !== "TOUS") {
            return specAgentBrutes.includes(profilF);
        }

        if (activiteF) {
            return specAgentBase.includes(activiteF);
        }

        return false;
    });

    if (formationsSpec.length === 0) {
        return "<span style='color:#94a3b8;'>Aucun suivi requis</span>";
    }

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
