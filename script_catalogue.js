let catalogue = [];

document.addEventListener("DOMContentLoaded", () => {
    chargerCatalogueInitial();
    
    document.getElementById("form-formation").addEventListener("submit", sauvegarderFormation);
    document.getElementById("file-input").addEventListener("change", chargerFichierLocal);
    document.getElementById("btn-cancel").addEventListener("click", reinitialiserFormulaire);
});

// Chargement automatique : va TOUJOURS chercher le fichier réseau le plus récent
function chargerCatalogueInitial() {
    // Le paramètre ?t=... empêche le navigateur de garder une vieille version en cache
    fetch('catalogueFormations.json?t=' + Date.now())
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
            catalogue = data;
            sauvegarderLocalement(); // Met à jour le secours local
            trierEtAfficherCatalogue();
            console.log("Catalogue réseau chargé avec succès.");
        })
        .catch(() => {
            console.warn("Impossible de joindre catalogueFormations.json. Passage au secours local.");
            // Si le réseau plante, on bascule sur la mémoire locale en secours
            const localData = localStorage.getItem("catalogueFormations");
            if (localData) {
                catalogue = JSON.parse(localData);
                trierEtAfficherCatalogue();
            }
        });
}

function sauvegarderLocalement() {
    localStorage.setItem("catalogueFormations", JSON.stringify(catalogue));
}

// Fonction de tri multi-critères : Type -> Activité -> Thème
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
    tbody.innerHTML = "";

    catalogue.forEach(item => {
        const tr = document.createElement("tr");
        const badgeClass = item.type === "Socle Commun" ? "badge-socle" : "badge-specialite";

        tr.innerHTML = `
            <td><span class="badge-type ${badgeClass}">${item.type}</span></td>
            <td><strong>${item.activite}</strong></td>
            <td>${item.libelle}</td>
            <td style="color:#cbd5e1; font-size:0.8rem;">${item.sequence || '-'}</td>
            <td><strong>${item.quota} h</strong></td>
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

    // 1. Mise à jour ou ajout dans la mémoire JS
    if (id) {
        const idx = catalogue.findIndex(f => f.id === id);
        if (idx !== -1) {
            catalogue[idx] = { ...catalogue[idx], type, activite, libelle, sequence: sequence || "-", quota };
        }
    } else {
        catalogue.push({
            id: "fmpa-" + Date.now().toString(),
            type,
            activite,
            libelle,
            sequence: sequence || "-",
            quota
        });
    }

    // 2. Sauvegarde locale et mise à jour du tableau visuel
    sauvegarderLocalement();
    trierEtAfficherCatalogue();
    reinitialiserFormulaire();

    // 3. Déclenchement automatique de l'écriture sur le fichier JSON réseau
    await exporterCatalogueJSON();
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

    document.getElementById("form-titre").innerText = "Modifier la Formation";
    document.getElementById("btn-save").innerText = "💾 Enregistrer les modifications";
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
    document.getElementById("form-titre").innerText = "Ajouter une Formation";
    document.getElementById("btn-save").innerText = "💾 Enregistrer dans le catalogue (JSON)";
    document.getElementById("btn-cancel").style.display = "none";
}

// Fonction de chargement de fichier local (JSON ou CSV)
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

// Exportation sécurisée avec gestion de secours pour les partages réseau
async function exporterCatalogueJSON() {
    catalogue = trierCatalogue(catalogue);
    const contenuJSON = JSON.stringify(catalogue, null, 2);

    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'catalogueFormations.json',
                types: [{
                    description: 'Fichier JSON',
                    accept: { 'application/json': ['.json'] },
                }],
            });

            // Utilisation de true (keepExistingData: false) pour contourner l'erreur de verrouillage réseau sous Edge
            const writable = await handle.createWritable();
            await writable.write(contenuJSON);
            await writable.close();
            return;
        } catch (err) {
            if (err.name === 'AbortError') {
                return; // L'utilisateur a juste annulé la fenêtre
            }
            console.warn("L'écriture directe sur le réseau a échoué (sécurité Edge/Windows). Passage au téléchargement classique :", err);
        }
    }

    // Solution de secours automatique si le système de fichiers réseau bloque l'accès direct
    telechargerJSONSecours(contenuJSON);
}

function telechargerJSONSecours(contenu) {
    const blob = new Blob([contenu], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalogueFormations.json";
    a.click();
    URL.revokeObjectURL(url);
}
