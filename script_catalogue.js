let catalogue = [];

document.addEventListener("DOMContentLoaded", () => {
    chargerCatalogueInitial();
    
    document.getElementById("form-formation").addEventListener("submit", sauvegarderFormation);
    document.getElementById("btn-charger").addEventListener("click", () => document.getElementById("file-input").click());
    document.getElementById("btn-exporter").addEventListener("click", exporterCatalogueJSON);
    document.getElementById("file-input").addEventListener("change", chargerFichierLocal);
    document.getElementById("btn-cancel").addEventListener("click", reinitialiserFormulaire);
});

// Chargement auto du catalogue JSON du dépôt
function chargerCatalogueInitial() {
    const localData = localStorage.getItem("catalogueFormations");
    if (localData) {
        catalogue = JSON.parse(localData);
        afficherCatalogue();
    }

    fetch('catalogueFormations.json')
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
            catalogue = data;
            sauvegarderLocalement();
            afficherCatalogue();
        })
        .catch(() => console.log("Chargement direct du JSON : mode local actif."));
}

function sauvegarderLocalement() {
    localStorage.setItem("catalogueFormations", JSON.stringify(catalogue));
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

function sauvegarderFormation(e) {
    e.preventDefault();
    const id = document.getElementById("form-id").value;
    const type = document.getElementById("type-module").value;
    const activite = document.getElementById("activite").value.trim().toUpperCase();
    const libelle = document.getElementById("libelle").value.trim();
    const sequence = document.getElementById("sequence").value.trim();
    const quota = parseFloat(document.getElementById("quota").value);

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

    sauvegarderLocalement();
    afficherCatalogue();
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

    document.getElementById("form-titre").innerText = "Modifier la Formation";
    document.getElementById("btn-save").innerText = "💾 Enregistrer les modifications";
    document.getElementById("btn-cancel").style.display = "block";
}

function supprimerFormation(id) {
    if (confirm("Supprimer cette formation du catalogue ?")) {
        catalogue = catalogue.filter(f => f.id !== id);
        sauvegarderLocalement();
        afficherCatalogue();
        reinitialiserFormulaire();
    }
}

function reinitialiserFormulaire() {
    document.getElementById("form-formation").reset();
    document.getElementById("form-id").value = "";
    document.getElementById("form-titre").innerText = "Ajouter une Formation";
    document.getElementById("btn-save").innerText = "➕ Ajouter au catalogue";
    document.getElementById("btn-cancel").style.display = "none";
}

function exporterCatalogueJSON() {
    const blob = new Blob([JSON.stringify(catalogue, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "catalogueFormations.json";
    a.click();
}

function chargerFichierLocal(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            catalogue = JSON.parse(evt.target.result);
            sauvegarderLocalement();
            afficherCatalogue();
        } catch {
            alert("Format JSON invalide.");
        }
    };
    reader.readAsText(file);
}
