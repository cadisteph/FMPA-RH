let catalogue = [];
let workbookGlobal = null; // Maintient la structure du fichier Excel en mémoire
let fileHandle = null;

document.addEventListener("DOMContentLoaded", () => {
    const formFormation = document.getElementById("form-formation");
    if (formFormation) {
        formFormation.addEventListener("submit", sauvegarderFormation);
    }

    const btnCancel = document.getElementById("btn-cancel");
    if (btnCancel) {
        btnCancel.addEventListener("click", reinitialiserFormulaire);
    }

    const btnConnect = document.getElementById("btn-connect-file");
    if (btnConnect) {
        btnConnect.addEventListener("click", lierFichierReseau);
    }

    const btnAjouterLigne = document.getElementById("btn-ajouter-ligne-profil");
    if (btnAjouterLigne) {
        btnAjouterLigne.addEventListener("click", () => ajouterLigneProfil());
    }

    const fileInput = document.getElementById("file-input");
    if (fileInput) {
        fileInput.addEventListener("change", chargerFichierLocal);
    }
});

/**
 * Connexion au fichier FMPA-RH.xlsx via File System Access API
 */
async function lierFichierReseau() {
    try {
        [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Fichier Excel FMPA-RH',
                accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
            }],
            multiple: false
        });

        const file = await fileHandle.getFile();
        const data = await file.arrayBuffer();
        traiterContenuXLSX(data);

        const btnConnect = document.getElementById("btn-connect-file");
        if (btnConnect) {
            btnConnect.innerText = "🌐 Réseau Connecté";
            btnConnect.classList.add("connecte");
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Erreur de sélection :", err);
            alert("L'accès au fichier Excel a échoué.");
        }
    }
}

/**
 * Traitement du buffer ArrayBuffer du fichier .xlsx
 */
function traiterContenuXLSX(arrayBuffer) {
    try {
        workbookGlobal = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Nom de l'onglet cible
        const nomOnglet = "catalogue";
        const sheetCatalogue = workbookGlobal.Sheets[nomOnglet] || workbookGlobal.Sheets[workbookGlobal.SheetNames[0]];

        if (!sheetCatalogue) {
            alert("Onglet 'catalogue' introuvable dans le fichier Excel.");
            return;
        }

        const rawData = XLSX.utils.sheet_to_json(sheetCatalogue, { defval: "" });

        catalogue = rawData.map((item, index) => {
            const rawId = item.id || item.ID || item['\ufeffid'];

            let modulations = [];
            const rawMod = String(item.modulations || item.dispenses || "").trim();
            
            if (rawMod !== "" && rawMod !== "[object Object]") {
                modulations = rawMod.split(';').map(mStr => {
                    const parts = mStr.split(':');
                    return {
                        profil: parts[0] ? parts[0].trim().toUpperCase() : '',
                        quota: parts[1] !== undefined ? parseFloat(parts[1]) : 0
                    };
                });
            }

            return {
                id: rawId ? String(rawId) : "fmpa-" + (Date.now() + index),
                type: item.type || item.Type || "Socle Commun",
                fmpa: item.fmpa || item.activite || "",
                activite: item.activite || item.Activité || "",
                libelle: item.libelle || item['Thème'] || item.Libellé || "",
                sequence: item.sequence || item['Séquence'] || "-",
                quota: parseFloat(item.quota || item['Durée(h)'] || 0),
                modulations: modulations
            };
        });

        // Alimente le datalist si un onglet RH existe dans le même classeur
        const sheetRH = workbookGlobal.Sheets["RH"] || workbookGlobal.Sheets["Agents"];
        if (sheetRH) {
            const agentsData = XLSX.utils.sheet_to_json(sheetRH, { defval: "" });
            alimenterDatalistProfils(agentsData);
        }

        trierEtAfficherCatalogue();
        reinitialiserFormulaire();
    } catch (err) {
        console.error("Erreur de lecture XLSX :", err);
        alert("Fichier XLSX invalide ou corrompu.");
    }
}

/**
 * Écriture des données mises à jour dans l'onglet "catalogue" du fichier .xlsx
 */
async function exporterFichierJSReseau() {
    if (!workbookGlobal || !fileHandle) return;

    const donneesPourExcel = catalogue.map(f => {
        let modulationsStr = "";
        if (f.modulations && Array.isArray(f.modulations) && f.modulations.length > 0) {
            modulationsStr = f.modulations
                .map(m => `${m.profil}:${m.quota ?? 0}`)
                .join(";");
        }

        return {
            id: f.id,
            type: f.type,
            fmpa: f.fmpa || f.activite,
            activite: f.activite,
            libelle: f.libelle,
            sequence: f.sequence || "-",
            quota: f.quota,
            modulations: modulationsStr
        };
    });

    // Conversion JSON vers feuille Excel
    const newSheet = XLSX.utils.json_to_sheet(donneesPourExcel);
    
    // Remplace l'onglet 'catalogue' dans le classeur global
    workbookGlobal.Sheets["catalogue"] = newSheet;
    if (!workbookGlobal.SheetNames.includes("catalogue")) {
        workbookGlobal.SheetNames.push("catalogue");
    }

    // Export au format binaire .xlsx
    const wbout = XLSX.write(workbookGlobal, { bookType: 'xlsx', type: 'array' });

    try {
        const writable = await fileHandle.createWritable();
        await writable.write(wbout);
        await writable.close();
    } catch (err) {
        console.error("Erreur d'écriture XLSX sur le réseau :", err);
        alert("L'écriture dans le fichier Excel réseau a échoué.");
    }
}

function chargerFichierLocal(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        traiterContenuXLSX(evt.target.result);
    };
    reader.readAsArrayBuffer(file);
}

function ajouterLigneProfil(profilNom = "", quotaValeur = "") {
    const conteneur = document.getElementById("liste-lignes-modulations");
    if (!conteneur) return;

    const divLigne = document.createElement("div");
    divLigne.className = "ligne-modulation";

    divLigne.innerHTML = `
        <input type="text" class="input-profil" list="liste-profils-dispenses" placeholder="Profil / Grade (ex: EQUIPIER)" value="${profilNom}">
        <input type="number" class="input-quota-mod" min="0" step="0.5" placeholder="Heures (ex: 6 ou 0)" value="${quotaValeur}">
        <button type="button" class="btn-suppr-ligne" title="Supprimer cette ligne">✕</button>
    `;

    divLigne.querySelector(".btn-suppr-ligne").addEventListener("click", () => {
        divLigne.remove();
    });

    conteneur.appendChild(divLigne);
}

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

    const conteneur = document.getElementById("liste-lignes-modulations");
    if (conteneur) conteneur.innerHTML = "";

    if (item.modulations && Array.isArray(item.modulations) && item.modulations.length > 0) {
        item.modulations.forEach(m => ajouterLigneProfil(m.profil, m.quota));
    }

    document.getElementById("form-titre").innerText = "Modifier la Formation";
    document.getElementById("btn-save").innerText = "💾 Enregistrer la modification";
    document.getElementById("btn-cancel").style.display = "block";
}

async function supprimerFormation(id) {
    if (confirm("Supprimer cette formation du catalogue ?")) {
        catalogue = catalogue.filter(f => f.id !== id);
        await exporterFichierJSReseau();
        trierEtAfficherCatalogue();
        reinitialiserFormulaire();
    }
}

function reinitialiserFormulaire() {
    document.getElementById("form-formation").reset();
    document.getElementById("form-id").value = "";
    
    const conteneur = document.getElementById("liste-lignes-modulations");
    if (conteneur) conteneur.innerHTML = "";

    document.getElementById("form-titre").innerText = "Ajouter une Formation";
    document.getElementById("btn-save").innerText = "💾 Enregistrer la formation";
    document.getElementById("btn-cancel").style.display = "none";
}

function alimenterDatalistProfils(tableauAgentsRH) {
    const datalist = document.getElementById("liste-profils-dispenses");
    if (!datalist || !Array.isArray(tableauAgentsRH)) return;

    const tousLesProfils = tableauAgentsRH.flatMap(agent => {
        const val = agent.profil || agent.Profil || agent.Fonction || "";
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map(p => p.trim());
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
