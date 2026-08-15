const CODE_ACCES_RH = "1811";
let estAuthentifieRH = false;
let ongletCibleApresConnexion = "";

const LISTE_SPECIALITES_RH = {
    "COD": [{ code: "COD1", theme: "COD1" }, { code: "COD6", theme: "COD6" }, { code: "COD6-Spé", theme: "COD6-Spé" }],
    "IBNB": [{ code: "IBNB1", theme: "IBNB1" }, { code: "IBNB2", theme: "IBNB2" }, { code: "IBNB3", theme: "IBNB3" }],
    "RAD": [{ code: "RAD1", theme: "RAD1" }, { code: "RAD2", theme: "RAD2" }, { code: "RAD3", theme: "RAD3" }],
    "RCH": [{ code: "RCH1", theme: "RCH1" }, { code: "RCH2", theme: "RCH2" }, { code: "RCH3", theme: "RCH3" }]
};

const LISTE_COMPETENCES_COMPLEMENTAIRES = [
    { code: "Cond.OPS", theme: "Cond.OPS" }, { code: "EAP", theme: "EAP" },
    { code: "ESU", theme: "ESU" }, { code: "FORCOD1", theme: "FORCOD1" },
    { code: "FORCOD6", theme: "FORCOD6" }, { code: "FORCOD6-Spé", theme: "FORCOD6-Spé" },
    { code: "FORSUAP", theme: "FORSUAP" }
];

const INITIAL_CATALOGUE = {
    "2026": {
        "SOCLE_TRANS": { activite: "TRANS", theme: "Transmissions & Sécurité", nom: "Transmissions & Sécurité", sequence: "-", quota: 2, duree: 2, type: "COMMUNE", domaine: "TRANS" },
        "SUAP1": { activite: "SUAP", theme: "SUAP1", nom: "Secours d'Urgence niveau 1", sequence: "-", quota: 6, duree: 6, type: "COMMUNE", domaine: "SUAP" },
        "INC1": { activite: "INC", theme: "INC1", nom: "Incendie niveau 1", sequence: "-", quota: 6, duree: 6, type: "COMMUNE", domaine: "INC" },
        "COD1": { activite: "COD", theme: "COD1", nom: "COD1", sequence: "-", quota: 4, duree: 4, type: "SPECIALITE", domaine: "COD" },
        "RCH1": { activite: "RCH", theme: "RCH1", nom: "RCH1", sequence: "-", quota: 6, duree: 6, type: "SPECIALITE", domaine: "RCH" }
    }
};

const INITIAL_AGENTS = [
    { id: 1, matricule: "95000", sexe: "Homme", nom: "DUPONT", prenom: "Jean", equipe: "SPV", statut: "SPV", grade: "SAP", fonction: "Equ", regime: "SPV", naissanceDate: "1985-04-12", naissanceLieu: "Rouen", telephone: "06-01-02-03-04", adresse: "10 RUE DE LA CASERNE", email: "j.dupont@sdis.fr", entreeSdis: "2010-01-01", datePL: "", dateVMA: "", specialites: ["COD1", "ESU"], tempsPartiel: "", engagementDiff: "SUAP", heuresFaites: { "SUAP1": 6, "SOCLE_TRANS": 2, "COD1": 4 }, commentaire: "SPV Engagement SUAP", disponibilite: true },
    { id: 2, matricule: "95001", sexe: "Femme", nom: "MARTIN", prenom: "Sophie", equipe: "Equipe A", statut: "SPP", grade: "ADJ", fonction: "CATE", regime: "G24", naissanceDate: "1992-09-23", naissanceLieu: "Le Havre", telephone: "06-05-06-07-08", adresse: "5 AVENUE DU CENTRE", email: "s.martin@gmail.com", entreeSdis: "2015-06-01", datePL: "", dateVMA: "", specialites: ["RCH1"], tempsPartiel: "100%", engagementDiff: "", heuresFaites: { "INC1": 6, "SUAP1": 6, "SOCLE_TRANS": 2, "RCH1": 6 }, commentaire: "SPP Tronc commun + Spé RCH", disponibilite: false }
];

let catalogue = JSON.parse(localStorage.getItem("sdis_catalogue")) || INITIAL_CATALOGUE;
let listeAgents = JSON.parse(localStorage.getItem("sdis_agents")) || INITIAL_AGENTS;
let historiqueSessions = JSON.parse(localStorage.getItem("sdis_sessions")) || [];

function echapperHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function normaliserSpecialites(specs) {
    if (!Array.isArray(specs)) return [];
    let res = [...specs];
    if (res.includes("COD6-Spé")) {
        if (!res.includes("COD6")) res.push("COD6");
        if (!res.includes("COD1")) res.push("COD1");
    } else if (res.includes("COD6")) {
        if (!res.includes("COD1")) res.push("COD1");
    }
    return res;
}

function formaterPrenom(str) {
    if (!str) return "";
    return str.trim().toLowerCase().replace(/(^|\s|-)\S/g, function(match) { return match.toUpperCase(); });
}

function formaterTelephone(str) {
    if (!str) return "";
    let cleaned = str.toString().replace(/\D/g, '');
    if (cleaned.length === 9) cleaned = "0" + cleaned;
    if (cleaned.length === 10) return cleaned.match(/.{1,2}/g).join('-');
    return str.trim();
}

function normaliserDate(str) {
    if (!str) return "";
    let val = str.toString().trim().replace(/^"|"$/g, '');
    if (!val) return "";
    let matchFr = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (matchFr) return `${matchFr[3]}-${matchFr[2].padStart(2, '0')}-${matchFr[1].padStart(2, '0')}`;
    let matchIso = val.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{3,4})$/);
    if (matchIso) return `${matchIso[1]}-${matchIso[2].padStart(2, '0')}-${matchIso[3].padStart(2, '0')}`;
    return val;
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

function sauvegarderTout() {
    localStorage.setItem("sdis_agents", JSON.stringify(listeAgents));
    localStorage.setItem("sdis_catalogue", JSON.stringify(catalogue));
    localStorage.setItem("sdis_sessions", JSON.stringify(historiqueSessions));
}

function changerOnglet(ongletId, bouton) {
    const ecranConnex = document.getElementById("ecran-connexion");
    if(ecranConnex) ecranConnex.style.display = "none";

    if ((ongletId === 'onglet-rh' || ongletId === 'onglet-config') && !estAuthentifieRH) {
        ongletCibleApresConnexion = ongletId;
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        if(bouton) bouton.classList.add('active');
        if(ecranConnex) ecranConnex.style.display = "block";
        const inputCode = document.getElementById("inputCodeSecret");
        if(inputCode) inputCode.focus();
        return;
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const cible = document.getElementById(ongletId);
    if(cible) cible.classList.add('active');
    if(bouton) bouton.classList.add('active');

    if(ongletId === 'onglet-suivi') { actualiserTableauSuivi(); actualiserFormulaireSaisieFMA(); }
    if(ongletId === 'onglet-spe') { actualiserTableauSuiviSpe(); actualiserFormulaireSaisieFMASpe(); }
    if(ongletId === 'onglet-rh') { actualiserFormulaireCompetencesRH(); actualiserTableauRH(); }
    if(ongletId === 'onglet-config') actualiserConfigCatalogue();
}

function verifierCodeAuthentification() {
    const saisie = document.getElementById("inputCodeSecret").value;
    const messageErreur = document.getElementById("erreur-connexion");
    if (saisie === CODE_ACCES_RH) {
        estAuthentifieRH = true;
        if(messageErreur) messageErreur.style.display = "none";
        document.getElementById("inputCodeSecret").value = "";
        document.getElementById("ecran-connexion").style.display = "none";
        let boutonCible = ongletCibleApresConnexion === 'onglet-rh' ? document.getElementById("btn-tab-rh") : document.getElementById("btn-tab-config");
        changerOnglet(ongletCibleApresConnexion, boutonCible);
    } else {
        if(messageErreur) {
            messageErreur.innerText = "❌ Code incorrect. Accès refusé.";
            messageErreur.style.display = "block";
        }
        document.getElementById("inputCodeSecret").value = "";
    }
}

function deconnexionRH() {
    estAuthentifieRH = false;
    const err = document.getElementById("erreur-connexion");
    if(err) err.style.display = "none";
    changerOnglet('onglet-suivi', document.getElementById("btn-tab-suivi"));
}

function getBadgeStatutClass(statut) {
    if (statut === 'SPP') return 'badge-spp';
    if (statut === 'PATS') return 'badge-pats';
    return 'badge-spv';
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

function calculerBasesGardes(dateNaissanceStr, dateEntreeStr, regime, fonction) {
    let baseG24 = 0, baseG12 = 0;
    if (!dateNaissanceStr || !dateEntreeStr) {
        if (regime === "G24") baseG24 = (fonction === "CDG") ? 74 : 92;
        else if (regime === "Mixte") { baseG24 = (fonction === "CDG") ? 67 : 83; baseG12 = (fonction === "CDG") ? 10 : 14; }
        else if (regime === "G12") baseG12 = 133;
        return { g24: baseG24, g12: baseG12 };
    }
    const dateNaissance = new Date(dateNaissanceStr);
    const age = 2026 - dateNaissance.getFullYear();

    if (regime === "G12") {
        baseG12 = (age < 45) ? 133 : (age <= 49 ? 132 : (age <= 54 ? 131 : (age <= 59 ? 130 : 129)));
    } else if (regime === "G24") {
        baseG24 = (fonction === "CDG") ? ((age < 45) ? 74 : 70) : ((age < 45) ? 92 : 88);
    } else if (regime === "Mixte") {
        baseG24 = 83; baseG12 = 14;
    }
    return { g24: baseG24, g12: baseG12 };
}

function obtenirDetailsGardes(agent) {
    if (agent.regime === "SHR" || agent.regime === "SPV" || agent.statut === "SPV" || agent.statut === "PATS") {
        return { total: "-", repartition: "-" };
    }
    const bases = calculerBasesGardes(agent.naissanceDate, agent.entreeSdis, agent.regime, agent.fonction);
    const ratioPartiel = parseFloat(agent.tempsPartiel || "100%") / 100;

    if (agent.regime === "G24") {
        let total = Math.ceil(bases.g24 * ratioPartiel);
        let gS1 = Math.floor(total / 2), gS2 = total - gS1;
        return { total: total.toString(), repartition: `S1: ${gS1} (${gS1*17}h) | S2: ${gS2} (${gS2*17}h)` };
    } else if (agent.regime === "G12") {
        let total = Math.ceil(bases.g12 * ratioPartiel);
        let gS1 = Math.floor(total / 2), gS2 = total - gS1;
        return { total: total.toString(), repartition: `S1: ${gS1} (${gS1*12}h) | S2: ${gS2} (${gS2*12}h)` };
    }
    return { total: "-", repartition: "-" };
}

function actualiserIndicateurGardes() {
    const elRegime = document.getElementById("agentRegime");
    if (!elRegime) return;
    const regime = elRegime.value;
    const statut = document.getElementById("agentStatut").value;
    const ratioPartiel = parseFloat(document.getElementById("agentTempsPartiel").value) / 100;

    const valeurGardesSpan = document.getElementById("valeurGardesDefault");
    const ratioSemestreSpan = document.getElementById("ratioSemestriel");

    if (!valeurGardesSpan || !ratioSemestreSpan) return;

    if (regime === "SHR" || regime === "SPV" || statut === "PATS") {
        valeurGardesSpan.innerText = "-";
        ratioSemestreSpan.innerText = "Non applicable";
        return;
    }

    const bases = calculerBasesGardes(document.getElementById("agentNaissanceDate").value, document.getElementById("agentEntreeSdis").value, regime, document.getElementById("agentFonction").value);
    if (regime === "G24") {
        let total = Math.ceil(bases.g24 * ratioPartiel);
        valeurGardesSpan.innerText = total.toString();
        ratioSemestreSpan.innerHTML = `Total annuel : ${total*17}h`;
    } else if (regime === "G12") {
        let total = Math.ceil(bases.g12 * ratioPartiel);
        valeurGardesSpan.innerText = total.toString();
        ratioSemestreSpan.innerHTML = `Total annuel : ${total*12}h`;
    }
}

function adapterFormulaireSelonStatut() {
    const statutEl = document.getElementById("agentStatut");
    if (!statutEl) return;
    const statut = statutEl.value;
    const grpPartiel = document.getElementById("groupTempsPartiel");
    const grpDiff = document.getElementById("groupEngagementDiff");
    const grpDispo = document.getElementById("groupDisponibilite");

    if (statut === "SPP" || statut === "PATS") {
        if(grpPartiel) grpPartiel.style.display = "flex";
        if(grpDiff) grpDiff.style.display = "none";
        if(grpDispo) grpDispo.style.display = "none";
        document.getElementById("agentEngagementDiff").value = "";
        document.getElementById("agentDisponibilite").checked = false;
    } else {
        if(grpPartiel) grpPartiel.style.display = "none";
        if(grpDiff) grpDiff.style.display = "flex";
        if(grpDispo) grpDispo.style.display = "flex";
        document.getElementById("agentTempsPartiel").value = "100%";
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

function actualiserFormulaireCompetencesRH() {
    const container = document.getElementById("containerCompetencesForm");
    if (!container) return;

    let html = '<div class="section-title" style="margin-top: 0; margin-bottom: 8px;">SPÉCIALITÉS</div><div class="form-grid-2">';
    Object.keys(LISTE_SPECIALITES_RH).forEach(act => {
        html += `<div class="form-group"><label>${echapperHTML(act)}</label><select class="comp-select"><option value="">Aucune</option>`;
        LISTE_SPECIALITES_RH[act].forEach(item => {
            html += `<option value="${echapperHTML(item.code)}">${echapperHTML(item.theme)}</option>`;
        });
        html += `</select></div>`;
    });
    html += '</div><div class="section-title" style="margin-top: 10px; margin-bottom: 8px;">COMPÉTENCES COMPLÉMENTAIRES</div><div style="display: flex; flex-wrap: wrap; gap: 10px;">';
    LISTE_COMPETENCES_COMPLEMENTAIRES.forEach(item => {
        html += `<label><input type="checkbox" class="comp-checkbox" value="${echapperHTML(item.code)}"> ${echapperHTML(item.code)}</label>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function filtrerListeAgents(prefix) {
    const fSexe = document.getElementById(prefix + "Sexe") ? document.getElementById(prefix + "Sexe").value : "";
    const fEquipe = document.getElementById(prefix + "Equipe") ? document.getElementById(prefix + "Equipe").value : "";
    const fStatut = document.getElementById(prefix + "Statut") ? document.getElementById(prefix + "Statut").value : "";
    const fRecherche = document.getElementById(prefix + "Recherche") ? document.getElementById(prefix + "Recherche").value.toLowerCase().trim() : "";

    return listeAgents.filter(agent => {
        if (fSexe && agent.sexe !== fSexe) return false;
        if (fEquipe && agent.equipe !== fEquipe) return false;
        if (fStatut && agent.statut !== fStatut) return false;
        if (fRecherche) {
            const terme = `${agent.matricule} ${agent.nom} ${agent.prenom}`.toLowerCase();
            if (!terme.includes(fRecherche)) return false;
        }
        return true;
    });
}

function reinitialiserFiltres(prefix) {
    ['Sexe','Equipe','Statut','Recherche'].forEach(f => {
        if(document.getElementById(prefix + f)) document.getElementById(prefix + f).value = "";
    });
    if (prefix === "rh_") actualiserTableauRH();
    if (prefix === "suivi_") actualiserTableauSuivi();
    if (prefix === "spe_") actualiserTableauSuiviSpe();
}

function actualiserTableauRH() {
    const corps = document.getElementById("corpsRH");
    if (!corps) return;
    corps.innerHTML = "";

    let agentsFiltres = filtrerListeAgents("rh_");
    agentsFiltres.sort((a, b) => (a.nom || "").localeCompare(b.nom || "", 'fr', { sensitivity: 'base' }));

    const compteur = document.getElementById("compteurAgentsRH");
    if (compteur) compteur.innerText = `${agentsFiltres.length} / ${listeAgents.length} agent(s)`;

    agentsFiltres.forEach(agent => {
        const detailsG = obtenirDetailsGardes(agent);
        let specsTriees = normaliserSpecialites(agent.specialites || []);
        let badgesSpecsHtml = specsTriees.map(s => `<span class="badge badge-spe">${echapperHTML(s)}</span>`).join(" ");

        corps.innerHTML += `
            <tr class="clickable-row" onclick="editerAgent(${agent.id})">
                <td>${echapperHTML(agent.matricule)}</td>
                <td>${echapperHTML(agent.sexe || 'Homme')}</td>
                <td><strong>${echapperHTML(agent.nom)}</strong> ${echapperHTML(agent.prenom)}</td>
                <td>${echapperHTML(agent.equipe)}</td>
                <td><span class="badge ${getBadgeStatutClass(agent.statut)}">${echapperHTML(agent.statut)}</span></td>
                <td>${echapperHTML(agent.grade) || '-'}</td>
                <td>${echapperHTML(agent.fonction) || '-'}</td>
                <td>${badgesSpecsHtml || '-'}</td>
                <td>${echapperHTML(agent.regime)}</td>
                <td>${echapperHTML(agent.tempsPartiel || agent.engagementDiff || '-')}</td>
                <td><strong>${detailsG.total}</strong></td>
                <td>${detailsG.repartition}</td>
                <td>${echapperHTML(agent.entreeSdis) || '-'}</td>
                <td>${echapperHTML(agent.datePL) || '-'}</td>
                <td>${echapperHTML(agent.dateVMA) || '-'}</td>
                <td>${echapperHTML(agent.telephone) || '-'}</td>
                <td>${echapperHTML(agent.email) || '-'}</td>
                <td>${echapperHTML(agent.naissanceDate) || '-'}${calculerAge(agent.naissanceDate)}</td>
                <td>${echapperHTML(agent.naissanceLieu) || '-'}</td>
                <td>${echapperHTML(agent.adresse) || '-'}</td>
                <td>${agent.statut === 'SPV' ? (agent.disponibilite ? '🔴 Oui' : '🟢 Non') : '-'}</td>
                <td>${echapperHTML(agent.commentaire) || '-'}</td>
            </tr>`;
    });
}

function editerAgent(id) {
    const agent = listeAgents.find(a => a.id === id);
    if (!agent) return;

    document.getElementById("agentId").value = agent.id;
    document.getElementById("agentMatricule").value = agent.matricule || "";
    document.getElementById("agentSexe").value = agent.sexe || "Homme";
    document.getElementById("agentNom").value = agent.nom || "";
    document.getElementById("agentPrenom").value = agent.prenom || "";
    document.getElementById("agentRegime").value = agent.regime || "G24";
    document.getElementById("agentEquipe").value = agent.equipe || "Equipe A";
    document.getElementById("agentStatut").value = agent.statut || "SPP";
    document.getElementById("agentGrade").value = agent.grade || "";
    document.getElementById("agentFonction").value = agent.fonction || "Equ";
    document.getElementById("agentTempsPartiel").value = agent.tempsPartiel || "100%";
    document.getElementById("agentEngagementDiff").value = agent.engagementDiff || "";
    document.getElementById("agentDisponibilite").checked = !!agent.disponibilite;
    document.getElementById("agentNaissanceDate").value = agent.naissanceDate || "";
    document.getElementById("agentNaissanceLieu").value = agent.naissanceLieu || "";
    document.getElementById("agentEntreeSdis").value = agent.entreeSdis || "";
    document.getElementById("agentDatePL").value = agent.datePL || "";
    document.getElementById("agentDateVMA").value = agent.dateVMA || "";
    document.getElementById("agentTelephone").value = agent.telephone || "";
    document.getElementById("agentEmail").value = agent.email || "";
    document.getElementById("agentAdresse").value = agent.adresse || "";
    document.getElementById("agentCommentaire").value = agent.commentaire || "";

    adapterFormulaireSelonStatut();

    const agentSpecs = agent.specialites || [];
    document.querySelectorAll(".comp-select").forEach(sel => {
        sel.value = "";
        for (let opt of sel.options) {
            if (opt.value && agentSpecs.includes(opt.value)) { sel.value = opt.value; break; }
        }
    });

    document.querySelectorAll(".comp-checkbox").forEach(chk => {
        chk.checked = agentSpecs.includes(chk.value);
    });

    const btnSuppr = document.getElementById("btnSupprimerAgent");
    const btnRaz = document.getElementById("btnRazFmaAgent");
    if(btnSuppr) btnSuppr.style.display = "inline-flex";
    if(btnRaz) btnRaz.style.display = "inline-flex";

    mettreAJourAffichageAge();
    actualiserIndicateurGardes();
}

function viderFormulaireRH() {
    const formRH = document.getElementById("formRH");
    if(formRH) formRH.reset();
    document.getElementById("agentId").value = "";
    
    const btnSuppr = document.getElementById("btnSupprimerAgent");
    const btnRaz = document.getElementById("btnRazFmaAgent");
    if(btnSuppr) btnSuppr.style.display = "none";
    if(btnRaz) btnRaz.style.display = "none";

    document.querySelectorAll(".comp-select").forEach(sel => sel.value = "");
    document.querySelectorAll(".comp-checkbox").forEach(chk => chk.checked = false);
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
        alert("⚠️ Veuillez remplir les champs obligatoires (Matricule, Nom, Prénom).");
        return;
    }

    let specsSaisies = [];
    document.querySelectorAll(".comp-select").forEach(sel => { if (sel.value) specsSaisies.push(sel.value); });
    document.querySelectorAll(".comp-checkbox:checked").forEach(chk => { specsSaisies.push(chk.value); });
    specsSaisies = Array.from(new Set(specsSaisies));

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
        engagementDiff: document.getElementById("agentEngagementDiff").value,
        disponibilite: document.getElementById("agentDisponibilite").checked,
        naissanceDate: document.getElementById("agentNaissanceDate").value,
        naissanceLieu: document.getElementById("agentNaissanceLieu").value.trim(),
        entreeSdis: document.getElementById("agentEntreeSdis").value,
        datePL: document.getElementById("agentDatePL").value,
        dateVMA: document.getElementById("agentDateVMA").value,
        telephone: formaterTelephone(document.getElementById("agentTelephone").value),
        email: document.getElementById("agentEmail").value.trim(),
        adresse: document.getElementById("agentAdresse").value.trim().toUpperCase(),
        commentaire: document.getElementById("agentCommentaire").value.trim(),
        specialites: specsSaisies,
        heuresFaites: idVal ? (listeAgents.find(a => a.id === parseInt(idVal))?.heuresFaites || {}) : {}
    };

    if (idVal) {
        const idx = listeAgents.findIndex(a => a.id === parseInt(idVal));
        if (idx !== -1) listeAgents[idx] = agentObj;
    } else {
        listeAgents.push(agentObj);
    }

    sauvegarderTout();
    actualiserTableauRH();
    viderFormulaireRH();
}

function supprimerAgent() {
    const idVal = document.getElementById("agentId").value;
    if (!idVal) return;
    if (confirm("❓ Êtes-vous sûr de vouloir supprimer cet agent ?")) {
        listeAgents = listeAgents.filter(a => a.id !== parseInt(idVal));
        sauvegarderTout();
        actualiserTableauRH();
        viderFormulaireRH();
    }
}

function reinitialiserFmaAgent() {
    const idVal = document.getElementById("agentId").value;
    if (!idVal) return;
    if (confirm("❓ Remettre à zéro toutes les heures de formation (FMA) enregistrées pour cet agent ?")) {
        const agent = listeAgents.find(a => a.id === parseInt(idVal));
        if (agent) {
            agent.heuresFaites = {};
            sauvegarderTout();
            alert("✅ Heures FMA réinitialisées pour cet agent.");
        }
    }
}

function exporterRHCSV() {
    let csv = "\uFEFFMatricule;Sexe;Nom;Prenom;Equipe;Statut;Grade;Fonction;Regime;TempsPartiel_Diff;DateNaissance;LieuNaissance;DateEntreeSDIS;DatePL;DateVMA;Telephone;Email;Adresse;DispoSPV;Specialites;Commentaire\n";
    listeAgents.forEach(a => {
        const specs = (a.specialites || []).join(",");
        csv += `"${a.matricule || ''}";"${a.sexe || 'Homme'}";"${a.nom || ''}";"${a.prenom || ''}";"${a.equipe || ''}";"${a.statut || ''}";"${a.grade || ''}";"${a.fonction || ''}";"${a.regime || ''}";"${a.tempsPartiel || a.engagementDiff || ''}";"${a.naissanceDate || ''}";"${a.naissanceLieu || ''}";"${a.entreeSdis || ''}";"${a.datePL || ''}";"${a.dateVMA || ''}";"${a.telephone || ''}";"${a.email || ''}";"${a.adresse || ''}";"${a.disponibilite ? 'Oui' : 'Non'}";"${specs}";"${(a.commentaire || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Effectifs_RH_SDIS_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function importerRHCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const lines = evt.target.result.split('\n');
        let ajouts = 0;
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = parseCSVLine(lines[i]);
            if (cols.length >= 4) {
                const mat = cols[0].replace(/"/g, '').trim();
                if (!mat) continue;
                let agent = listeAgents.find(a => a.matricule === mat);
                if (!agent) {
                    agent = { id: Date.now() + i, matricule: mat, heuresFaites: {} };
                    listeAgents.push(agent);
                }
                agent.sexe = cols[1] ? cols[1].replace(/"/g, '').trim() : "Homme";
                agent.nom = cols[2] ? cols[2].replace(/"/g, '').trim().toUpperCase() : "";
                agent.prenom = cols[3] ? formaterPrenom(cols[3].replace(/"/g, '')) : "";
                agent.equipe = cols[4] ? cols[4].replace(/"/g, '').trim() : "Equipe A";
                agent.statut = cols[5] ? cols[5].replace(/"/g, '').trim() : "SPP";
                agent.grade = cols[6] ? cols[6].replace(/"/g, '').trim() : "";
                agent.fonction = cols[7] ? cols[7].replace(/"/g, '').trim() : "Equ";
                agent.regime = cols[8] ? cols[8].replace(/"/g, '').trim() : "G24";
                const tpDiff = cols[9] ? cols[9].replace(/"/g, '').trim() : "";
                if (agent.statut === "SPV") agent.engagementDiff = tpDiff; else agent.tempsPartiel = tpDiff;
                agent.naissanceDate = cols[10] ? normaliserDate(cols[10]) : "";
                agent.naissanceLieu = cols[11] ? cols[11].replace(/"/g, '').trim() : "";
                agent.entreeSdis = cols[12] ? normaliserDate(cols[12]) : "";
                agent.datePL = cols[13] ? normaliserDate(cols[13]) : "";
                agent.dateVMA = cols[14] ? normaliserDate(cols[14]) : "";
                agent.telephone = cols[15] ? formaterTelephone(cols[15]) : "";
                agent.email = cols[16] ? cols[16].replace(/"/g, '').trim() : "";
                agent.adresse = cols[17] ? cols[17].replace(/"/g, '').trim() : "";
                agent.disponibilite = cols[18] ? cols[18].replace(/"/g, '').trim().toLowerCase() === 'oui' : false;
                agent.specialites = cols[19] ? cols[19].replace(/"/g, '').split(',').filter(s => s) : [];
                agent.commentaire = cols[20] ? cols[20].replace(/"/g, '').trim() : "";
                ajouts++;
            }
        }
        sauvegarderTout();
        actualiserTableauRH();
        alert(`✅ Importation réussie : ${ajouts} agents mis à jour/ajoutés.`);
    };
    reader.readAsText(file);
}

function actualiserTableauSuivi() {
    const corps = document.getElementById("corpsSuivi");
    if (!corps) return;
    corps.innerHTML = "";
    let agents = filtrerListeAgents("suivi_");
    const cpt = document.getElementById("compteurAgentsSuivi");
    if(cpt) cpt.innerText = `${agents.length} agent(s)`;

    const cat = catalogue["2026"] || {};

    agents.forEach(agent => {
        let totalFait = 0, totalExige = 0;
        let badges = [];

        Object.keys(cat).forEach(mKey => {
            if (cat[mKey].type === "COMMUNE") {
                let req = cat[mKey].quota || 0;
                let done = (agent.heuresFaites && agent.heuresFaites[mKey]) || 0;
                totalExige += req;
                totalFait += done;

                let badgeClass = done >= req ? "status-success" : (done > 0 ? "status-warning" : "status-danger");
                badges.push(`<span class="${badgeClass}">${cat[mKey].theme}: ${done}/${req}h</span>`);
            }
        });

        corps.innerHTML += `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="chkAgentFma" value="${agent.id}" onchange="mettreAJourCompteurFMA()"></td>
                <td><strong>${echapperHTML(agent.nom)}</strong> ${echapperHTML(agent.prenom)}</td>
                <td>${echapperHTML(agent.equipe)}</td>
                <td>${echapperHTML(agent.grade)} / ${echapperHTML(agent.fonction)}</td>
                <td>${badges.join(" ")}</td>
                <td><strong>${totalFait}/${totalExige}h</strong></td>
            </tr>`;
    });
}

function actualiserTableauSuiviSpe() {
    const corps = document.getElementById("corpsSuiviSpe");
    if (!corps) return;
    corps.innerHTML = "";
    let agents = filtrerListeAgents("spe_").filter(a => (a.specialites || []).length > 0);
    const cpt = document.getElementById("compteurAgentsSuiviSpe");
    if(cpt) cpt.innerText = `${agents.length} spécialiste(s)`;

    const cat = catalogue["2026"] || {};

    agents.forEach(agent => {
        let totalFait = 0, totalExige = 0;
        let badges = [];

        (agent.specialites || []).forEach(mKey => {
            let info = cat[mKey] || { theme: mKey, quota: 0 };
            let req = info.quota || 0;
            let done = (agent.heuresFaites && agent.heuresFaites[mKey]) || 0;
            totalExige += req;
            totalFait += done;

            let badgeClass = done >= req ? "status-success" : (done > 0 ? "status-warning" : "status-danger");
            badges.push(`<span class="${badgeClass}">${info.theme}: ${done}/${req}h</span>`);
        });

        corps.innerHTML += `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="chkAgentSpe" value="${agent.id}" onchange="mettreAJourCompteurSpe()"></td>
                <td><strong>${echapperHTML(agent.nom)}</strong> ${echapperHTML(agent.prenom)}</td>
                <td>${echapperHTML(agent.equipe)}</td>
                <td>${echapperHTML(agent.grade)} / ${echapperHTML(agent.fonction)}</td>
                <td>${badges.join(" ") || 'Aucune spé à recycler'}</td>
                <td><strong>${totalFait}/${totalExige}h</strong></td>
            </tr>`;
    });
}

function toutCocherAgentsFMA(val) {
    document.querySelectorAll(".chkAgentFma").forEach(c => c.checked = val);
    mettreAJourCompteurFMA();
}

function mettreAJourCompteurFMA() {
    let nb = document.querySelectorAll(".chkAgentFma:checked").length;
    const info = document.getElementById("fmaInfoSelection");
    if(info) info.innerHTML = `👥 <strong>${nb} agent(s) sélectionné(s)</strong>`;
}

function toutCocherAgentsSpe(val) {
    document.querySelectorAll(".chkAgentSpe").forEach(c => c.checked = val);
    mettreAJourCompteurSpe();
}

function mettreAJourCompteurSpe() {
    let nb = document.querySelectorAll(".chkAgentSpe:checked").length;
    const info = document.getElementById("speInfoSelection");
    if(info) info.innerHTML = `👥 <strong>${nb} spécialiste(s) sélectionné(s)</strong>`;
}

function actualiserFormulaireSaisieFMA() {
    const selectAct = document.getElementById("fmaActivite");
    if(!selectAct) return;
    selectAct.innerHTML = '<option value="">-- Choisir Activité --</option>';
    const cat = catalogue["2026"] || {};
    let doms = new Set();
    Object.values(cat).forEach(m => { if (m.type === "COMMUNE") doms.add(m.activite); });
    doms.forEach(d => { selectAct.innerHTML += `<option value="${d}">${d}</option>`; });
}

function actualiserThemesFMA() {
    const act = document.getElementById("fmaActivite").value;
    const selectForm = document.getElementById("fmaFormation");
    if(!selectForm) return;
    selectForm.innerHTML = '<option value="">-- Choisir Thème --</option>';
    if (!act) { selectForm.disabled = true; return; }

    const cat = catalogue["2026"] || {};
    Object.keys(cat).forEach(k => {
        if (cat[k].type === "COMMUNE" && cat[k].activite === act) {
            selectForm.innerHTML += `<option value="${k}">${cat[k].theme}</option>`;
        }
    });
    selectForm.disabled = false;
}

function actualiserFormulaireSaisieFMASpe() {
    const selectAct = document.getElementById("speActivite");
    if(!selectAct) return;
    selectAct.innerHTML = '<option value="">-- Choisir Domaine --</option>';
    const cat = catalogue["2026"] || {};
    let doms = new Set();
    Object.values(cat).forEach(m => { if (m.type === "SPECIALITE") doms.add(m.activite); });
    doms.forEach(d => { selectAct.innerHTML += `<option value="${d}">${d}</option>`; });
}

function actualiserThemesFMASpe() {
    const act = document.getElementById("speActivite").value;
    const selectForm = document.getElementById("speFormation");
    if(!selectForm) return;
    selectForm.innerHTML = '<option value="">-- Choisir Spécialité --</option>';
    if (!act) { selectForm.disabled = true; return; }

    const cat = catalogue["2026"] || {};
    Object.keys(cat).forEach(k => {
        if (cat[k].type === "SPECIALITE" && cat[k].activite === act) {
            selectForm.innerHTML += `<option value="${k}">${cat[k].theme}</option>`;
        }
    });
    selectForm.disabled = false;
}

function calculerDureeSession() {
    const hDeb = document.getElementById("fmaHeureDebut").value;
    const hFin = document.getElementById("fmaHeureFin").value;
    if (hDeb && hFin) {
        let [h1, m1] = hDeb.split(':').map(Number);
        let [h2, m2] = hFin.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        const out = document.getElementById("fmaDureeCalculee");
        if(out) out.innerText = (diff / 60).toFixed(1) + " h";
    }
}

function calculerDureeSessionSpe() {
    const hDeb = document.getElementById("speHeureDebut").value;
    const hFin = document.getElementById("speHeureFin").value;
    if (hDeb && hFin) {
        let [h1, m1] = hDeb.split(':').map(Number);
        let [h2, m2] = hFin.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        const out = document.getElementById("speDureeCalculee");
        if(out) out.innerText = (diff / 60).toFixed(1) + " h";
    }
}

function enregistrerSessionFMA() {
    const ids = Array.from(document.querySelectorAll(".chkAgentFma:checked")).map(c => parseInt(c.value));
    const moduleKey = document.getElementById("fmaFormation").value;
    const duree = parseFloat(document.getElementById("fmaDureeCalculee").innerText);

    if (ids.length === 0 || !moduleKey || isNaN(duree) || duree <= 0) {
        alert("⚠️ Veuillez cocher au moins un agent et choisir un module valide.");
        return;
    }

    ids.forEach(id => {
        let agent = listeAgents.find(a => a.id === id);
        if (agent) {
            if (!agent.heuresFaites) agent.heuresFaites = {};
            agent.heuresFaites[moduleKey] = (agent.heuresFaites[moduleKey] || 0) + duree;
            historiqueSessions.push({
                id: Date.now() + Math.random(),
                agentNom: `${agent.nom} ${agent.prenom}`,
                equipe: agent.equipe,
                dateFormation: document.getElementById("fmaDate").value,
                activite: document.getElementById("fmaActivite").value,
                moduleKey: moduleKey,
                heureDebut: document.getElementById("fmaHeureDebut").value,
                heureFin: document.getElementById("fmaHeureFin").value,
                duree: duree
            });
        }
    });

    sauvegarderTout();
    actualiserTableauSuivi();
    alert("✅ Saisie de groupe enregistrée avec succès !");
}

function enregistrerSessionFMASpe() {
    const ids = Array.from(document.querySelectorAll(".chkAgentSpe:checked")).map(c => parseInt(c.value));
    const moduleKey = document.getElementById("speFormation").value;
    const duree = parseFloat(document.getElementById("speDureeCalculee").innerText);

    if (ids.length === 0 || !moduleKey || isNaN(duree) || duree <= 0) {
        alert("⚠️ Veuillez cocher au moins un spécialiste et choisir une formation valide.");
        return;
    }

    ids.forEach(id => {
        let agent = listeAgents.find(a => a.id === id);
        if (agent) {
            if (!agent.heuresFaites) agent.heuresFaites = {};
            agent.heuresFaites[moduleKey] = (agent.heuresFaites[moduleKey] || 0) + duree;
            historiqueSessions.push({
                id: Date.now() + Math.random(),
                agentNom: `${agent.nom} ${agent.prenom}`,
                equipe: agent.equipe,
                dateFormation: document.getElementById("speDate").value,
                activite: document.getElementById("speActivite").value,
                moduleKey: moduleKey,
                heureDebut: document.getElementById("speHeureDebut").value,
                heureFin: document.getElementById("speHeureFin").value,
                duree: duree
            });
        }
    });

    sauvegarderTout();
    actualiserTableauSuiviSpe();
    alert("✅ Saisie de spécialité enregistrée !");
}

function actualiserConfigCatalogue() {
    const corps = document.getElementById("corpsCatalogue");
    if (!corps) return;
    corps.innerHTML = "";
    const cat = catalogue["2026"] || {};

    Object.keys(cat).forEach(key => {
        let item = cat[key];
        corps.innerHTML += `
            <tr>
                <td><span class="badge ${item.type === 'COMMUNE' ? 'badge-spp' : 'badge-spe'}">${item.type}</span></td>
                <td>${echapperHTML(item.activite)}</td>
                <td><strong>${echapperHTML(item.theme)}</strong></td>
                <td>${echapperHTML(item.sequence || '-')}</td>
                <td>${item.quota} h</td>
                <td>
                    <button class="btn btn-warning" style="padding:2px 6px; font-size:0.75em;" onclick="editerModuleCatalogue('${key}')">✏️ Edit</button>
                    <button class="btn btn-danger" style="padding:2px 6px; font-size:0.75em;" onclick="supprimerModuleCatalogue('${key}')">🗑️</button>
                </td>
            </tr>`;
    });
}

function ajouterModuleCatalogue() {
    const type = document.getElementById("newType").value;
    const code = document.getElementById("newCode").value.trim().toUpperCase();
    const nom = document.getElementById("newNom").value.trim();
    const seq = document.getElementById("newSequence").value.trim();
    const quota = parseFloat(document.getElementById("newQuota").value);
    const editKey = document.getElementById("editModuleKey").value;

    if (!code || !nom || isNaN(quota)) {
        alert("⚠️ Veuillez remplir tous les champs obligatoires du module.");
        return;
    }

    if (!catalogue["2026"]) catalogue["2026"] = {};
    const key = editKey || code;

    catalogue["2026"][key] = {
        type: type,
        activite: code,
        theme: nom,
        nom: nom,
        sequence: seq || "-",
        quota: quota,
        duree: quota,
        domaine: code
    };

    sauvegarderTout();
    actualiserConfigCatalogue();
    viderFormulaireCatalogue();
}

function editerModuleCatalogue(key) {
    const item = catalogue["2026"][key];
    if (!item) return;
    document.getElementById("editModuleKey").value = key;
    document.getElementById("newType").value = item.type;
    document.getElementById("newCode").value = item.activite;
    document.getElementById("newNom").value = item.theme;
    document.getElementById("newSequence").value = item.sequence !== "-" ? item.sequence : "";
    document.getElementById("newQuota").value = item.quota;
    
    const titre = document.getElementById("titreFormModule");
    const btnSubmit = document.getElementById("btnEnregistrerModule");
    const btnCancel = document.getElementById("btnAnnulerEditModule");

    if(titre) titre.innerText = "Modifier le Module";
    if(btnSubmit) btnSubmit.innerText = "Mettre à jour";
    if(btnCancel) btnCancel.style.display = "inline-flex";
}

function viderFormulaireCatalogue() {
    const form = document.getElementById("formCatalogueModule");
    if(form) form.reset();
    document.getElementById("editModuleKey").value = "";
    
    const titre = document.getElementById("titreFormModule");
    const btnSubmit = document.getElementById("btnEnregistrerModule");
    const btnCancel = document.getElementById("btnAnnulerEditModule");

    if(titre) titre.innerText = "Ajouter / Modifier Module";
    if(btnSubmit) btnSubmit.innerText = "Ajouter au catalogue";
    if(btnCancel) btnCancel.style.display = "none";
}

function supprimerModuleCatalogue(key) {
    if (confirm(`❓ Supprimer définitivement le module "${key}" du catalogue ?`)) {
        delete catalogue["2026"][key];
        sauvegarderTout();
        actualiserConfigCatalogue();
    }
}

function ouvrirModalHistorique() {
    const corps = document.getElementById("corpsHistorique");
    if(!corps) return;
    corps.innerHTML = "";
    historiqueSessions.sort((a,b) => new Date(b.dateFormation) - new Date(a.dateFormation)).forEach(s => {
        corps.innerHTML += `
            <tr>
                <td>${echapperHTML(s.agentNom)}</td>
                <td>${echapperHTML(s.equipe)}</td>
                <td>${echapperHTML(s.dateFormation)}</td>
                <td>${echapperHTML(s.activite)}</td>
                <td>${echapperHTML(s.moduleKey)}</td>
                <td>${echapperHTML(s.heureDebut)}</td>
                <td>${echapperHTML(s.heureFin)}</td>
                <td><strong>${s.duree} h</strong></td>
                <td><button class="btn btn-danger" style="padding:2px 6px; font-size:0.75em;" onclick="supprimerSessionHistorique(${s.id})">Annuler</button></td>
            </tr>`;
    });
    const modal = document.getElementById("modal-historique");
    if(modal) modal.style.display = "block";
}

function fermerModalHistorique() {
    const modal = document.getElementById("modal-historique");
    if(modal) modal.style.display = "none";
}

function supprimerSessionHistorique(id) {
    if (confirm("❓ Annuler cette saisie d'heures pour l'agent ?")) {
        const session = historiqueSessions.find(s => s.id === id);
        if (session) {
            let agent = listeAgents.find(a => `${a.nom} ${a.prenom}` === session.agentNom);
            if (agent && agent.heuresFaites && agent.heuresFaites[session.moduleKey]) {
                agent.heuresFaites[session.moduleKey] = Math.max(0, agent.heuresFaites[session.moduleKey] - session.duree);
            }
            historiqueSessions = historiqueSessions.filter(s => s.id !== id);
            sauvegarderTout();
            ouvrirModalHistorique();
            actualiserTableauSuivi();
            actualiserTableauSuiviSpe();
        }
    }
}

// Initialisation au chargement de la page
window.onload = function() {
    actualiserTableauSuivi();
    actualiserFormulaireCompetencesRH();
    actualiserTableauRH();
};

document.addEventListener('DOMContentLoaded', () => {
    const btnReseau = document.getElementById('btnConnecterReseau');
    
    if (btnReseau) {
        btnReseau.addEventListener('click', () => {
            // Placez le code de votre fonction ici, ou appelez-la :
            console.log("Tentative de connexion au réseau...");
            
            // Si votre fonction existe déjà plus bas/haut dans le script :
            if (typeof connecterFichierReseau === 'function') {
                connecterFichierReseau();
            } else {
                alert("La logique de connexion reste à définir dans le script.");
            }
        });
    }
});
