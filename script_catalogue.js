let catalogue = [];
let fileHandle = null;

document.addEventListener("DOMContentLoaded", () => {
    chargerCatalogueInitial();
    
    // Écouteur pour la soumission du formulaire
    const formFormation = document.getElementById("form-formation");
    if (formFormation) {
        formFormation.addEventListener("submit", sauvegarderFormation);
    }

    // Écouteur pour le bouton Annuler
    const btnCancel = document.getElementById("btn-cancel");
    if (btnCancel) {
        btnCancel.addEventListener("click", reinitialiserFormulaire);
    }

    // Bouton pour lier le fichier réseau directement au clic
    const btnConnect = document.getElementById("btn-connect-file");
    if (btnConnect) {
        btnConnect.addEventListener("click", lierFichierReseau);
    }

    // NOUVEAU : Écouteur pour le bouton d'ajout de ligne profil/quota
    const btnAjouterLigne = document.getElementById("btn-ajouter-ligne-profil");
    if (btnAjouterLigne) {
        btnAjouterLigne.addEventListener("click", () => ajouterLigneProfil());
    }

    const fileInput = document.getElementById("file-input");
    if (fileInput) {
        fileInput.addEventListener("change", chargerFichierLocal);
    }
});

function chargerCatalogueInitial() {
    const localData = localStorage.getItem("catalogueFormations");
    
    if (localData) {
        catalogue = JSON.parse(localData);
    } else if (typeof catalogueInitial !== 'undefined') {
        catalogue = catalogueInitial;
        sauvegarderLocalement();
    } else {
        catalogue = [];
    }

    trierEtAfficherCatalogue();
}

function sauvegarderLocalement() {
    localStorage.setItem("catalogueFormations", JSON.stringify(catalogue));
}

/**
 * Fonction déclenchée DIRECTEMENT par le clic utilisateur sur le bouton
 */
async function lierFichierReseau() {
    try {
        [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Fichier JavaScript Catalogue',
                accept: { 'text/javascript': ['.js'] },
            }],
            multiple: false
        });

        const btnConnect = document.getElementById("btn-connect-file");
        if (btnConnect) {
            btnConnect.innerText = "🌐 Réseau Connecté";
            btnConnect.classList.add("connecte"); // Applique le style vert fixe
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Erreur de sélection :", err);
            alert("L'accès au fichier a échoué.");
        }
    }
}

/**
 * Écriture silencieuse dans le fichier déjà lié
 */
async function exporterFichierJSReseau() {
    if (!fileHandle) return; // Si pas lié, on passe sans erreur

    const contenuJS = `const catalogueInitial = ${JSON.stringify(catalogue, null, 4)};`;
    
    try {
        const writable = await fileHandle.createWritable();
        await writable.write(contenuJS);
        await writable.close();
    } catch (err) {
        console.error("Erreur d'écriture sur le réseau :", err);
        alert("Attention : Enregistré en local, mais l'écriture sur le réseau a échoué.");
    }
}

/**
 * Génère dynamiquement une ligne de saisie Profil + Quota dans le formulaire
 */
function ajouterLigneProfil(profilNom = "", quotaValeur = "") {
    const conteneur = document.getElementById("liste-lignes-modulations");
    if (!conteneur) return;

    const divLigne = document.createElement("div");
    divLigne.className = "ligne-modulation";

    divLigne.innerHTML = `
        <input type="text" class="input-profil" list="liste-profils-dispenses" placeholder="Profil / Grade (ex: EQUIPPIER)" value="${profilNom}">
        <input type="number" class="input-quota-mod" min="0" step="0.5" placeholder="Heures (ex: 6 ou 0)" value="${quotaValeur}">
        <button type="button" class="btn-suppr-ligne" title="Supprimer cette ligne">✕</button>
    `;

    // Suppression de la ligne au clic sur ✕
    divLigne.querySelector(".btn-suppr-ligne").addEventListener("click", () => {
        divLigne.remove();
    });

    conteneur.appendChild(divLigne);
}

// Tri : Type -> Activité -> Thème
function trierCatalogue(data) {
    return data.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === "Socle Commun" ? -1 : 1;
        }
        const compActivite = a.activite.localeCompare(b.activite, 'fr', { sensitivity: 'base' });
        if (compActivite !== 0) {
            return compActivite;
        }
        return a.libelle.localeCompare(b.libelle, 'fr', { numeric: true, sensitivity: 'base' });
    });
}

function trierEtAfficherCatalogue() {
    catalogue = trierCatalogue(catalogue);
    afficherCatalogue();
}

function afficherCatalogue() {
    const tbody = document.getElementById("liste-formations");
    if (!tbody) return;
    
    tbody.innerHTML = "";

    catalogue.forEach(item => {
        const tr = document.createElement("tr");
        const badgeClass = item.type === "Socle Commun" ? "badge-socle" : "badge-specialite";
        
        let affichageDispenses = "Aucune";

        if (item.modulations && item.modulations.length > 0) {
            affichageDispenses = item.modulations.map(m => {
                return m.quota === 0 ? `${m.profil} (0h)` : `${m.profil} (${m.quota}h)`;
            }).join(", ");
        } else if (item.dispenses && item.dispenses.length > 0) {
            // Lecture des anciennes données sans heures précisées (considérées comme 0h)
            affichageDispenses = item.dispenses.map(p => `${p} (0h)`).join(", ");
        }

        tr.innerHTML = `
            <td><span class="badge-type ${badgeClass}">${item.type}</span></td>
            <td><strong>${item.activite}</strong></td>
            <td>${item.libelle}</td>
            <td style="color:#cbd5e1; font-size:0.8rem;">${item.sequence || '-'}</td>
            <td><strong>${item.quota} h</strong></td>
            <td><small style="color:#94a3b8;">${affichageDispenses}</small></td>
            <td>
                <button class="btn-action btn-edit" onclick="editerFormation('${item.id}')">Éditer ✏️</button>
                <button class="btn-action btn-delete" onclick="supprimerFormation('${item.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function sauvegarderFormation(e) {
    e.preventDefault();
    const id = document.getElementById("form-id").value;
    const type = document.getElementById("type-module").value;
    const activite = document.getElementById("activite").value.trim().toUpperCase();
    const libelle = document.getElementById("libelle").value.trim();
    const sequence = document.getElementById("sequence").value.trim();
    const quota = parseFloat(document.getElementById("quota").value);

    // Récupération dynamique de toutes les lignes "Profil / Quota"
    const modulations = [];
    const lignes = document.querySelectorAll(".ligne-modulation");

    lignes.forEach(ligne => {
        const inputProfil = ligne.querySelector(".input-profil").value.trim().toUpperCase();
        const inputQuotaVal = ligne.querySelector(".input-quota-mod").value.trim();

        if (inputProfil !== "") {
            const quotaHeures = inputQuotaVal !== "" ? parseFloat(inputQuotaVal) : 0;
            modulations.push({
                profil: inputProfil,
                quota: quotaHeures
            });
        }
    });

    if (id) {
        const idx = catalogue.findIndex(f => f.id === id);
        if (idx !== -1) {
            catalogue[idx] = { 
                ...catalogue[idx], 
                type, 
                activite, 
                libelle, 
                sequence: sequence || "-", 
                quota,
                modulations
            };
        }
    } else {
        catalogue.push({
            id: "fmpa-" + Date.now().toString(),
            type,
            activite,
            libelle,
            sequence: sequence || "-",
            quota,
            modulations
        });
    }

    sauvegarderLocalement();
    await exporterFichierJSReseau();
    trierEtAfficherCatalogue();
    reinitialiserFormulaire();
}

function editerFormation(id) {
    const item = catalogue.find(f => f.id === id);
    if (!item) return;

    document.getElementById("form-id").value = item.id;
    document.getElementById("type-module").value = item.type;
    document.getElementById("activite").value = item.activite;
    document.getElementById("libelle").value = item.libelle;
    document.getElementById("sequence").value = item.sequence === "-" ? "" : item.sequence;
    document.getElementById("quota").value = item.quota;

    // Réinitialiser le conteneur des lignes dans le formulaire
    const conteneur = document.getElementById("liste-lignes-modulations");
    if (conteneur) conteneur.innerHTML = "";

    // Reconstruire les lignes Profil/Quota enregistrées
    if (item.modulations && Array.isArray(item.modulations) && item.modulations.length > 0) {
        item.modulations.forEach(m => ajouterLigneProfil(m.profil, m.quota));
    } else if (item.dispenses && Array.isArray(item.dispenses) && item.dispenses.length > 0) {
        // Rétrocompatibilité : si l'élément utilisait l'ancien format string, on applique 0h
        item.dispenses.forEach(p => ajouterLigneProfil(p, 0));
    }

    document.getElementById("form-titre").innerText = "Modifier la Formation";
    document.getElementById("btn-save").innerText = "💾 Enregistrer la modification";
    document.getElementById("btn-cancel").style.display = "block";

    trierEtAfficherCatalogue();
    reinitialiserFormulaire();
}

async function supprimerFormation(id) {
    if (confirm("Supprimer cette formation du catalogue ?")) {
        catalogue = catalogue.filter(f => f.id !== id);
        sauvegarderLocalement();
        await exporterFichierJSReseau();
        trierEtAfficherCatalogue();
        reinitialiserFormulaire();
    }
}

function reinitialiserFormulaire() {
    document.getElementById("form-formation").reset();
    document.getElementById("form-id").value = "";
    
    // Vider toutes les lignes de profil modulé
    const conteneur = document.getElementById("liste-lignes-modulations");
    if (conteneur) conteneur.innerHTML = "";

    document.getElementById("form-titre").innerText = "Ajouter une Formation";
    document.getElementById("btn-save").innerText = "💾 Enregistrer la formation";
    document.getElementById("btn-cancel").style.display = "none";
}

function chargerFichierLocal(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            catalogue = JSON.parse(evt.target.result);
            sauvegarderLocalement();
            trierEtAfficherCatalogue();
            reinitialiserFormulaire();
        } catch {
            alert("Format JSON invalide.");
        }
    };
    reader.readAsText(file);
}

function alimenterDatalistProfils(tableauAgentsRH) {
    const datalist = document.getElementById("liste-profils-dispenses");
    if (!datalist || !Array.isArray(tableauAgentsRH)) return;

    const tousLesProfils = tableauAgentsRH.flatMap(agent => {
        if (Array.isArray(agent.profil)) return agent.profil;
        if (typeof agent.profil === 'string') return agent.profil.split(',').map(p => p.trim());
        return [];
    });

    const profilsUniques = [...new Set(tousLesProfils)].filter(p => p.length > 0).sort();

    datalist.innerHTML = "";
    profilsUniques.forEach(profil => {
        const option = document.createElement("option");
        option.value = profil;
        datalist.appendChild(option);
    });
}
