window.fileHandleReseau = null;

// Liste par défaut si le CSV n'est pas encore connecté
let listeAgents = [
    { id: 1, matricule: "95000", sexe: "Homme", nom: "DUPONT", prenom: "Jean", equipe: "SPV", statut: "SPV", grade: "SAP", fonction: "Equ", regime: "SPV", engagement: "Complet", datePL: "", dateVMA: "", entreeSdis: "2015-06-01", naissanceDate: "1985-04-12", lieuNaissance: "LE HAVRE (76)", telephone: "06-01-02-03-04", email: "j.dupont@sdis.fr", adresse: "12 RUE DE LA PAIX 76600 LE HAVRE", commentaire: "Fiche de test" },
    { id: 2, matricule: "95001", sexe: "Femme", nom: "MARTIN", prenom: "Sophie", equipe: "Equipe A", statut: "SPP", grade: "ADJ", fonction: "CATE", regime: "G24", tempsPartiel: "100%", datePL: "2023-01-15", dateVMA: "2023-05-20", entreeSdis: "2012-09-01", naissanceDate: "1992-09-23", lieuNaissance: "ROUEN (76)", telephone: "06-05-06-07-08", email: "s.martin@sdis.fr", adresse: "5 AVENUE FOCH 76600 LE HAVRE", commentaire: "" }
];

/* ==========================================================================
   1. UTILITAIRES DE FORMATAGE & DATES
   ========================================================================== */

function echapperHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formaterPrenom(str) {
    if (!str) return "";
    return str.trim().toLowerCase().replace(/(^|\s|-)\S/g, match => match.toUpperCase());
}

function formaterTelephone(str) {
    if (!str) return "";
    let cleaned = str.toString().replace(/\D/g, '');
    if (cleaned.length === 9) cleaned = "0" + cleaned;
    if (cleaned.length === 10) return cleaned.match(/.{1,2}/g).join('-');
    return str.trim();
}

function calculerAge(dateNaissanceStr) {
    if (!dateNaissanceStr) return "";
    const dateNaissance = new Date(dateNaissanceStr);
    const aujourdhui = new Date();
    let age = aujourdhui.getFullYear() - dateNaissance.getFullYear();
    const m = aujourdhui.getMonth() - dateNaissance.getMonth();
    if (m < 0 || (m === 0 && aujourdhui.getDate() < dateNaissance.getDate())) age--;
    return age >= 0 ? ` (${age} ans)` : "";
}

function mettreAJourAffichageAge() {
    const dateInput = document.getElementById("agentNaissanceDate");
    const label = document.getElementById("labelAge");
    if (dateInput && label) label.innerText = calculerAge(dateInput.value);
}

function parseCSVLine(str) {
    let arr = [], quote = false, c = 0, col = '';
    while (c < str.length) {
        let cc = str[c];
        if (cc === '"') {
            if (quote && str[c+1] === '"') { col += '"'; c++; }
            else { quote = !quote; }
        } else if ((cc === ';' || cc === ',') && !quote) {
            arr.push(col); col = '';
        } else { col += cc; }
        c++;
    }
    arr.push(col);
    return arr;
}

/* ==========================================================================
   2. CALCUL DYNAMIQUE DES BASES DE GARDES
   ========================================================================== */

function calculerBasesGardes(dateNaissanceStr, dateEntreeStr, regime, fonction) {
    let baseG24 = 0, baseG12 = 0;
    
    if (!dateNaissanceStr || !dateEntreeStr) {
        if (regime === "G24") baseG24 = (fonction === "CDG") ? 74 : 92;
        else if (regime === "Mixte") { baseG24 = (fonction === "CDG") ? 67 : 83; baseG12 = (fonction === "CDG") ? 10 : 14; }
        else if (regime === "G12") baseG12 = 133;
        return { g24: baseG24, g12: baseG12 };
    }

    const dateEntree = new Date(dateEntreeStr);
    const dateNaissance = new Date(dateNaissanceStr);
    const estListe2 = (dateEntree < new Date("2013-10-01") && dateNaissance <= new Date("1976-12-31"));
    const age = 2026 - dateNaissance.getFullYear();

    if (regime === "G12") {
        if (age < 45) baseG12 = 133;
        else if (age <= 49) baseG12 = 132;
        else if (age <= 54) baseG12 = 131;
        else if (age <= 59) baseG12 = 130;
        else baseG12 = 129;
    } else if (regime === "G24") {
        if (fonction === "CDG") {
            if (estListe2) {
                if (age < 45) baseG24 = 74; else if (age <= 49) baseG24 = 71; else if (age <= 54) baseG24 = 70; else if (age <= 59) baseG24 = 69; else baseG24 = 68;
            } else {
                if (age < 45) baseG24 = 74; else if (age <= 49) baseG24 = 73; else if (age <= 54) baseG24 = 71; else if (age <= 59) baseG24 = 70; else baseG24 = 69;
            }
        } else {
            if (age < 45) baseG24 = 92; else if (age <= 49) baseG24 = 91; else if (age <= 54) baseG24 = 89; else if (age <= 59) baseG24 = 88; else baseG24 = 87;
        }
    } else if (regime === "Mixte") {
        if (fonction === "CDG") {
            if (estListe2) {
                if (age < 47) { baseG24 = 67; baseG12 = 10; } else if (age === 47) { baseG24 = 67; baseG12 = 9; } else if (age === 48) { baseG24 = 67; baseG12 = 8; } else if (age === 49) { baseG24 = 67; baseG12 = 7; } else if (age <= 54) { baseG24 = 66; baseG12 = 7; } else if (age <= 59) { baseG24 = 65; baseG12 = 7; } else { baseG24 = 64; baseG12 = 7; }
            } else {
                if (age < 45) { baseG24 = 67; baseG12 = 10; } else if (age <= 49) { baseG24 = 67; baseG12 = 9; } else if (age <= 54) { baseG24 = 66; baseG12 = 9; } else if (age <= 59) { baseG24 = 65; baseG12 = 9; } else { baseG24 = 64; baseG12 = 9; }
            }
        } else {
            if (estListe2) {
                if (age < 47) { baseG24 = 83; baseG12 = 14; } else if (age === 47) { baseG24 = 83; baseG12 = 13; } else if (age === 48) { baseG24 = 83; baseG12 = 12; } else if (age === 49) { baseG24 = 83; baseG12 = 11; } else if (age <= 54) { baseG24 = 82; baseG12 = 11; } else if (age <= 59) { baseG24 = 81; baseG12 = 11; } else { baseG24 = 80; baseG12 = 11; }
            } else {
                if (age < 45) { baseG24 = 83; baseG12 = 14; } else if (age <= 49) { baseG24 = 83; baseG12 = 13; } else if (age <= 54) { baseG24 = 82; baseG12 = 13; } else if (age <= 59) { baseG24 = 81; baseG12 = 13; } else { baseG24 = 80; baseG12 = 13; }
            }
        }
    }
    return { g24: baseG24, g12: baseG12 };
}

function obtenirDetailsGardes(agent) {
    if (!agent || agent.regime === "SHR" || agent.regime === "SPV" || agent.statut === "SPV" || agent.statut === "PATS") {
        return { total: "-", repartition: "-" };
    }

    const bases = calculerBasesGardes(agent.naissanceDate, agent.entreeSdis, agent.regime, agent.fonction);
    
    let ratio = 1;
    if (agent.tempsPartiel && agent.tempsPartiel.includes("%")) {
        let val = parseInt(agent.tempsPartiel);
        if (!isNaN(val)) ratio = val / 100;
    }

    let g24 = Math.round(bases.g24 * ratio);
    let g12 = Math.round(bases.g12 * ratio);

    if (agent.regime === "G24") {
        let s1 = Math.floor(g24 / 2);
        let s2 = Math.ceil(g24 / 2);
        let totalHeures = g24 * 17;
        return {
            total: `${g24}`,
            repartition: `S1: ${s1} (${s1 * 17}h) | S2: ${s2} (${s2 * 17}h) <span class="total-annuel-highlight">[${totalHeures}h]</span>`
        };
    } else if (agent.regime === "G12") {
        let s1 = Math.floor(g12 / 2);
        let s2 = Math.ceil(g12 / 2);
        let totalHeures = g12 * 12;
        return {
            total: `${g12}`,
            repartition: `S1: ${s1} (${s1 * 12}h) | S2: ${s2} (${s2 * 12}h) <span class="total-annuel-highlight">[${totalHeures}h]</span>`
        };
    } else if (agent.regime === "Mixte") {
        let g24_s1 = Math.floor(g24 / 2);
        let g24_s2 = Math.ceil(g24 / 2);
        let g12_s1 = Math.floor(g12 / 2);
        let g12_s2 = Math.ceil(g12 / 2);

        let heures_s1 = (g24_s1 * 17) + (g12_s1 * 12);
        let heures_s2 = (g24_s2 * 17) + (g12_s2 * 12);
        let totalHeures = heures_s1 + heures_s2;

        return {
            total: `${g24}/${g12}`,
            repartition: `S1: ${g24_s1}/${g12_s1} (${heures_s1}h) | S2: ${g24_s2}/${g12_s2} (${heures_s2}h) <span class="total-annuel-highlight">[${totalHeures}h]</span>`
        };
    }

    return { total: "-", repartition: "-" };
}

function actualiserIndicateurGardes() {
    const regime = document.getElementById("agentRegime") ? document.getElementById("agentRegime").value : "";
    const fonction = document.getElementById("agentFonction") ? document.getElementById("agentFonction").value : "";
    const naissanceDate = document.getElementById("agentNaissanceDate") ? document.getElementById("agentNaissanceDate").value : "";
    const entreeSdis = document.getElementById("agentEntreeSdis") ? document.getElementById("agentEntreeSdis").value : "";
    const tempsPartiel = document.getElementById("agentTempsPartiel") ? document.getElementById("agentTempsPartiel").value : "";
    const statut = document.getElementById("agentStatut") ? document.getElementById("agentStatut").value : "";

    const elValeur = document.getElementById("valeurGardes");
    const elRatio = document.getElementById("ratioSemestre");

    if (!elValeur || !elRatio) return;

    const dummyAgent = { regime, fonction, naissanceDate, entreeSdis, tempsPartiel, statut };
    const details = obtenirDetailsGardes(dummyAgent);

    elValeur.innerHTML = details.total;
    elRatio.innerHTML = details.repartition;
}

/* ==========================================================================
   3. LOGIQUE DU FORMULAIRE ET DES ÉQUIPES
   ========================================================================== */

function adapterFormulaireSelonStatut() {
    const statut = document.getElementById('agentStatut') ? document.getElementById('agentStatut').value : "";
    const groupTempsPartiel = document.getElementById('groupTempsPartiel');
    const groupEngagement = document.getElementById('groupEngagement');

    if (groupTempsPartiel && groupEngagement) {
        if (statut === 'SPV') {
            groupTempsPartiel.style.display = 'none';
            groupEngagement.style.display = 'block';
        } else {
            groupTempsPartiel.style.display = 'block';
            groupEngagement.style.display = 'none';
        }
    }

    actualiserIndicateurGardes();
}

function gererChangementRegime() {
    const regime = document.getElementById("agentRegime").value;
    const selectEquipe = document.getElementById("agentEquipe");
    const selectStatut = document.getElementById("agentStatut");

    if (regime === "SPV") { selectEquipe.value = "SPV"; selectStatut.value = "SPV"; }
    else if (regime === "G12") { selectEquipe.value = "Equipe G12"; if (selectStatut.value !== "PATS") selectStatut.value = "SPP"; }
    else if (regime === "SHR") { selectEquipe.value = "Encadrement"; if (selectStatut.value !== "PATS") selectStatut.value = "SPP"; }
    
    adapterFormulaireSelonStatut();
}

function gererChangementEquipe() {
    const equipe = document.getElementById("agentEquipe").value;
    const selectRegime = document.getElementById("agentRegime");
    const selectStatut = document.getElementById("agentStatut");

    if (equipe === "SPV") { selectRegime.value = "SPV"; selectStatut.value = "SPV"; }
    else if (equipe === "Equipe G12") { selectRegime.value = "G12"; if (selectStatut.value !== "PATS") selectStatut.value = "SPP"; }
    else if (equipe === "Encadrement") { selectRegime.value = "SHR"; if (selectStatut.value !== "PATS") selectStatut.value = "SPP"; }
    
    adapterFormulaireSelonStatut();
}

/* ==========================================================================
   4. LOGIQUE DU TABLEAU RH ET ÉDITION
   ========================================================================== */

function obtenirGardesTheoriques(agent) {
    const details = obtenirDetailsGardes(agent);
    return details.total;
}

function actualiserTableauRH() {
    const corps = document.getElementById("corpsRH");
    if (!corps) return;
    corps.innerHTML = "";

    const fSexe = document.getElementById("rh_sexe").value;
    const fEquipe = document.getElementById("rh_equipe").value;
    const fStatut = document.getElementById("rh_statut").value;
    const fRecherche = document.getElementById("rh_recherche").value.toLowerCase().trim();

    let agentsFiltres = listeAgents.filter(agent => {
        if (fSexe && agent.sexe !== fSexe) return false;
        if (fEquipe && agent.equipe !== fEquipe) return false;
        if (fStatut && agent.statut !== fStatut) return false;
        if (fRecherche) {
            const terme = `${agent.matricule} ${agent.nom} ${agent.prenom}`.toLowerCase();
            if (!terme.includes(fRecherche)) return false;
        }
        return true;
    });

    agentsFiltres.sort((a, b) => (a.nom || "").localeCompare(b.nom || "", 'fr', { sensitivity: 'base' }));

    const compteur = document.getElementById("compteurAgentsRH");
    if (compteur) compteur.innerText = `${agentsFiltres.length} / ${listeAgents.length} agent(s)`;

    agentsFiltres.forEach(agent => {
        // Temps partiel vs Engagement
        let tpEngagement = "-";
        if (agent.statut === "SPV") {
            tpEngagement = agent.engagement || "Complet";
        } else if (agent.statut === "SPP") {
            tpEngagement = agent.tempsPartiel || "100%";
        }

        // Regroupement Coordonnées (Tel, Email, Adresse)
        let coords = [];
        if (agent.telephone) coords.push(echapperHTML(agent.telephone));
        if (agent.email) coords.push(echapperHTML(agent.email));
        if (agent.adresse) coords.push(echapperHTML(agent.adresse.toUpperCase()));
        let coordsText = coords.join("<br>") || "-";

        corps.innerHTML += `
            <tr style="cursor:pointer; border-bottom:1px solid #e2e8f0;" onclick="editerAgent(${agent.id})">
                <td style="padding: 6px 8px;">${echapperHTML(agent.matricule)}</td>
                <td style="padding: 6px 8px;"><strong>${echapperHTML(agent.nom)}</strong> ${echapperHTML(agent.prenom)}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.sexe || 'Homme')}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.equipe)}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.statut)}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.grade) || '-'}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.fonction) || '-'}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.regime)}</td>
                <td style="padding: 6px 8px;">${tpEngagement}</td>
                <td style="padding: 6px 8px;"><strong>${obtenirGardesTheoriques(agent)}</strong></td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.datePL) || '-'}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.dateVMA) || '-'}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.entreeSdis) || '-'}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.naissanceDate) || '-'}${calculerAge(agent.naissanceDate)}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.lieuNaissance) || '-'}</td>
                <td style="padding: 6px 8px; font-size: 0.85em;">${coordsText}</td>
            </tr>`;
    });
}

function reinitialiserFiltres() {
    document.getElementById("rh_sexe").value = "";
    document.getElementById("rh_equipe").value = "";
    document.getElementById("rh_statut").value = "";
    document.getElementById("rh_recherche").value = "";
    actualiserTableauRH();
}

function editerAgent(id) {
    const agent = listeAgents.find(a => a.id === id);
    if (!agent) return;

    document.getElementById("agentId").value = agent.id;
    document.getElementById("agentMatricule").value = agent.matricule || "";
    document.getElementById("agentSexe").value = agent.sexe || "Homme";
    document.getElementById("agentNom").value = agent.nom || "";
    document.getElementById("agentPrenom").value = agent.prenom || "";
    document.getElementById("agentRegime").value = agent.regime || "";
    document.getElementById("agentEquipe").value = agent.equipe || "";
    document.getElementById("agentStatut").value = agent.statut || "";
    document.getElementById("agentGrade").value = agent.grade || "";
    document.getElementById("agentFonction").value = agent.fonction || "";
    document.getElementById("agentTempsPartiel").value = agent.tempsPartiel || "100%";
    document.getElementById("agentEngagement").value = agent.engagement || "Complet";
    
    document.getElementById("agentDatePL").value = agent.datePL || "";
    document.getElementById("agentDateVMA").value = agent.dateVMA || "";
    document.getElementById("agentEntreeSdis").value = agent.entreeSdis || "";
    document.getElementById("agentNaissanceDate").value = agent.naissanceDate || "";
    document.getElementById("agentLieuNaissance").value = agent.lieuNaissance || "";
    
    document.getElementById("agentTelephone").value = agent.telephone || "";
    document.getElementById("agentEmail").value = agent.email || "";
    document.getElementById("agentAdresse").value = agent.adresse || "";
    document.getElementById("agentCommentaire").value = agent.commentaire || "";

    adapterFormulaireSelonStatut();
    mettreAJourAffichageAge();
    actualiserIndicateurGardes();
    document.getElementById("btnSupprimerAgent").style.display = "inline-block";
}

function viderFormulaireRH() {
    document.getElementById("formRH").reset();
    document.getElementById("agentId").value = "";
    document.getElementById("btnSupprimerAgent").style.display = "none";
    adapterFormulaireSelonStatut();
    mettreAJourAffichageAge();
    actualiserIndicateurGardes();
}

function enregistrerAgent() {
    const idVal = document.getElementById("agentId").value;
    const matricule = document.getElementById("agentMatricule").value.trim();
    const nom = document.getElementById("agentNom").value.trim().toUpperCase();
    const prenom = formaterPrenom(document.getElementById("agentPrenom").value);

    if (!matricule || !nom || !prenom) {
        alert("⚠️ Champs obligatoires manquants (Matricule, Nom, Prénom).");
        return;
    }

    let agentObj = {
        id: idVal ? parseInt(idVal) : Date.now(),
        matricule: matricule,
        sexe: document.getElementById("agentSexe").value,
        nom: nom,
        prenom: prenom,
        regime: document.getElementById("agentRegime").value,
        equipe: document.getElementById("agentEquipe").value,
        statut: document.getElementById("agentStatut").value,
        grade: document.getElementById("agentGrade").value,
        fonction: document.getElementById("agentFonction").value,
        tempsPartiel: document.getElementById("agentTempsPartiel").value,
        engagement: document.getElementById("agentEngagement").value,
        datePL: document.getElementById("agentDatePL").value,
        dateVMA: document.getElementById("agentDateVMA").value,
        entreeSdis: document.getElementById("agentEntreeSdis").value,
        naissanceDate: document.getElementById("agentNaissanceDate").value,
        lieuNaissance: document.getElementById("agentLieuNaissance").value.toUpperCase(),
        telephone: formaterTelephone(document.getElementById("agentTelephone").value),
        email: document.getElementById("agentEmail").value.trim(),
        adresse: document.getElementById("agentAdresse").value.trim().toUpperCase(),
        commentaire: document.getElementById("agentCommentaire").value.trim()
    };

    if (idVal) {
        const idx = listeAgents.findIndex(a => a.id === parseInt(idVal));
        if (idx !== -1) listeAgents[idx] = agentObj;
    } else {
        listeAgents.push(agentObj);
    }

    actualiserTableauRH();
    viderFormulaireRH();
}

function supprimerAgent() {
    const idVal = document.getElementById("agentId").value;
    if (!idVal) return;
    if (confirm("❓ Êtes-vous sûr de vouloir supprimer cet agent ?")) {
        listeAgents = listeAgents.filter(a => a.id !== parseInt(idVal));
        actualiserTableauRH();
        viderFormulaireRH();
    }
}

/* ==========================================================================
   5. LIEN AVEC LE FICHIER CSV RÉSEAU
   ========================================================================== */

async function connecterFichierReseau() {
    try {
        [window.fileHandleReseau] = await window.showOpenFilePicker({
            types: [{ description: 'Fichier CSV', accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'] } }],
            multiple: false
        });

        const file = await window.fileHandleReseau.getFile();
        const contenuTexte = await file.text();
        const lignes = contenuTexte.split(/\r?\n/);
        let agentsReseau = [];

        for (let i = 1; i < lignes.length; i++) {
            const ligne = lignes[i].trim();
            if (!ligne) continue;
            
            const cols = parseCSVLine(ligne);
            if (cols.length >= 4) {
                const mat = cols[0].replace(/"/g, '').trim();
                if (!mat) continue;

                agentsReseau.push({
                    id: Date.now() + i,
                    matricule: mat,
                    sexe: cols[1] ? cols[1].replace(/"/g, '').trim() : "Homme",
                    nom: cols[2] ? cols[2].replace(/"/g, '').trim().toUpperCase() : "",
                    prenom: cols[3] ? formaterPrenom(cols[3].replace(/"/g, '')) : "",
                    equipe: cols[4] ? cols[4].replace(/"/g, '').trim() : "",
                    statut: cols[5] ? cols[5].replace(/"/g, '').trim() : "",
                    grade: cols[6] ? cols[6].replace(/"/g, '').trim() : "",
                    fonction: cols[7] ? cols[7].replace(/"/g, '').trim() : "",
                    regime: cols[8] ? cols[8].replace(/"/g, '').trim() : "",
                    tempsPartiel: cols[9] ? cols[9].replace(/"/g, '').trim() : "100%",
                    engagement: cols[10] ? cols[10].replace(/"/g, '').trim() : "Complet",
                    naissanceDate: cols[11] ? cols[11].replace(/"/g, '').trim() : "",
                    lieuNaissance: cols[12] ? cols[12].replace(/"/g, '').trim().toUpperCase() : "",
                    entreeSdis: cols[13] ? cols[13].replace(/"/g, '').trim() : "",
                    datePL: cols[14] ? cols[14].replace(/"/g, '').trim() : "",
                    dateVMA: cols[15] ? cols[15].replace(/"/g, '').trim() : "",
                    telephone: cols[16] ? formaterTelephone(cols[16]) : "",
                    email: cols[17] ? cols[17].replace(/"/g, '').trim() : "",
                    adresse: cols[18] ? cols[18].replace(/"/g, '').trim().toUpperCase() : "",
                    commentaire: cols[20] ? cols[20].replace(/"/g, '').trim() : ""
                });
            }
        }

        listeAgents = agentsReseau;
        actualiserTableauRH();
        document.getElementById("statusReseau").innerText = "🌐 Connecté : enregistrement possible";
        document.getElementById("statusReseau").style.color = "#08e3f5";
        alert(`Chargement réussi : ${agentsReseau.length} agents importés.`);

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Erreur d'accès :", err);
            alert("Erreur lors de la connexion au fichier réseau.");
        }
    }
}

async function enregistrerFichierReseau() {
    if (!window.fileHandleReseau) {
        alert("⚠️ Aucun fichier connecté. Cliquez d'abord sur '🔗 Connecter'.");
        return;
    }

    try {
        const options = { mode: 'readwrite' };
        if ((await window.fileHandleReseau.queryPermission(options)) !== 'granted') {
            if ((await window.fileHandleReseau.requestPermission(options)) !== 'granted') {
                alert("❌ Autorisation refusée pour la modification du fichier.");
                return;
            }
        }

        let csvContent = "\uFEFFMatricule;Sexe;Nom;Prenom;Equipe;Statut;Grade;Fonction;Regime;TempsPartiel;Engagement;DateNaissance;LieuNaissance;DateEntreeSDIS;DatePL;DateVMA;Telephone;Email;Adresse;DispoSPV;Commentaire\n";
        
        listeAgents.forEach(a => {
            const comm = (a.commentaire || '').replace(/"/g, '""');
            csvContent += `"${a.matricule || ''}";"${a.sexe || 'Homme'}";"${a.nom || ''}";"${a.prenom || ''}";"${a.equipe || ''}";"${a.statut || ''}";"${a.grade || ''}";"${a.fonction || ''}";"${a.regime || ''}";"${a.tempsPartiel || '100%'}";"${a.engagement || 'Complet'}";"${a.naissanceDate || ''}";"${a.lieuNaissance || ''}";"${a.entreeSdis || ''}";"${a.datePL || ''}";"${a.dateVMA || ''}";"${a.telephone || ''}";"${a.email || ''}";"${a.adresse || ''}";"";"${comm}"\n`;
        });

        const writable = await window.fileHandleReseau.createWritable();
        await writable.write(csvContent);
        await writable.close();

        alert(`💾 Fichier sauvegardé avec succès (${listeAgents.length} agents).`);

    } catch (err) {
        console.error("Erreur lors de la sauvegarde :", err);
        alert("❌ Erreur de sauvegarde : " + err.message);
    }
}

/* ==========================================================================
   6. ÉCOUTEURS D'ÉVÉNEMENTS & DOMCONTENTLOADED
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const idsAEcouter = [
        "agentRegime", 
        "agentFonction", 
        "agentNaissanceDate", 
        "agentEntreeSdis", 
        "agentTempsPartiel", 
        "agentStatut"
    ];

    idsAEcouter.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', actualiserIndicateurGardes);
            el.addEventListener('input', actualiserIndicateurGardes);
        }
    });

    const elStatut = document.getElementById("agentStatut");
    if (elStatut) {
        elStatut.addEventListener('change', adapterFormulaireSelonStatut);
    }

    const elRegime = document.getElementById("agentRegime");
    if (elRegime) {
        elRegime.addEventListener('change', gererChangementRegime);
    }

    const elEquipe = document.getElementById("agentEquipe");
    if (elEquipe) {
        elEquipe.addEventListener('change', gererChangementEquipe);
    }

    adapterFormulaireSelonStatut();
    actualiserIndicateurGardes();
    actualiserTableauRH();
});

window.onload = function() {
    actualiserTableauRH();
};
