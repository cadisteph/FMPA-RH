let catalogue = [];

document.addEventListener("DOMContentLoaded", () => {
    chargerCatalogueInitial();
    
    // Écouteur pour la soumission du formulaire (Ajout / Modification + Sauvegarde)
    const formFormation = document.getElementById("form-formation");
    if (formFormation) {
        formFormation.addEventListener("submit", sauvegarderFormation);
    }

    // Écouteur pour le bouton Annuler
    const btnCancel = document.getElementById("btn-cancel");
    if (btnCancel) {
        btnCancel.addEventListener("click", reinitialiserFormulaire);
    }

    // Sécurité au cas où l'input fichier existe encore dans le HTML
    const fileInput = document.getElementById("file-input");
    if (fileInput) {
        fileInput.addEventListener("change", chargerFichierLocal);
    }
});

function chargerCatalogueInitial() {
    // 1. Priorité au cache local si tu viens d'ajouter/modifier une formation dans la session
    const localData = localStorage.getItem("catalogueFormations");
    
    if (localData) {
        catalogue = JSON.parse(localData);
    } else if (typeof catalogueInitial !== 'undefined') {
        // 2. Chargement direct du fichier JS réseau
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
        
        // Formatage de l'affichage des dispenses
        const affichageDispenses = (item.dispenses && item.dispenses.length > 0) 
            ? item.dispenses.join(", ") 
            : "Aucune";

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

    // Récupération de la saisie texte et découpage par virgule pour créer le tableau
    const dispensesInput = document.getElementById("dispenses") ? document.getElementById("dispenses").value : "";
    const dispenses = dispensesInput 
        ? dispensesInput.split(",").map(p => p.trim()).filter(p => p.length > 0)
        : [];

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
                dispenses
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
            dispenses
        });
    }

    sauvegarderLocalement();
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

    // Affichage des dispenses sous forme de texte séparé par des virgules
    const inputDispenses = document.getElementById("dispenses");
    if (inputDispenses) {
        inputDispenses.value = (item.dispenses && item.dispenses.length > 0) 
            ? item.dispenses.join(", ") 
            : "";
    }

    document.getElementById("form-titre").innerText = "Modifier la Formation";
    document.getElementById("btn-save").innerText = "💾 Enregistrer la modification";
    document.getElementById("btn-cancel").style.display = "block";
}

function supprimerFormation(id) {
    if (confirm("Supprimer cette formation du catalogue ?")) {
        catalogue = catalogue.filter(f => f.id !== id);
        sauvegarderLocalement();
        trierEtAfficherCatalogue();
        reinitialiserFormulaire();
    }
}

function reinitialiserFormulaire() {
    document.getElementById("form-formation").reset();
    document.getElementById("form-id").value = "";
    
    // Vider le champ texte des dispenses
    const inputDispenses = document.getElementById("dispenses");
    if (inputDispenses) {
        inputDispenses.value = "";
    }

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
        } catch {
            alert("Format JSON invalide.");
        }
    };
    reader.readAsText(file);
}

/**
 * À appeler lors du chargement de ton fichier CSV RH
 * Remplit automatiquement la datalist "liste-profils-dispenses"
 */
function alimenterDatalistProfils(tableauAgentsRH) {
    const datalist = document.getElementById("liste-profils-dispenses");
    if (!datalist || !Array.isArray(tableauAgentsRH)) return;

    // 1. Extraire tous les profils / spécialités du fichier CSV
    const tousLesProfils = tableauAgentsRH.flatMap(agent => {
        if (Array.isArray(agent.profil)) return agent.profil;
        if (typeof agent.profil === 'string') return agent.profil.split(',').map(p => p.trim());
        return [];
    });

    // 2. Conserver les profils uniques et non vides
    const profilsUniques = [...new Set(tousLesProfils)].filter(p => p.length > 0).sort();

    // 3. Remplir la datalist
    datalist.innerHTML = "";
    profilsUniques.forEach(profil => {
        const option = document.createElement("option");
        option.value = profil;
        datalist.appendChild(option);
    });
}
