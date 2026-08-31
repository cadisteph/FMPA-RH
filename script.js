window.fileHandleReseau = null;

// Classeur Excel actuellement ouvert
let classeurXLSX = null;
let nomFichierXLSX = "FMPA-RH.xlsx";

// Liste par défaut
let listeAgents = [];

// Nom exact des 23 colonnes de l'onglet baseAgents
const HEADERS_BASE_AGENTS = [
    "Matricule",
    "Sexe",
    "Nom",
    "Prenom",
    "Equipe",
    "Statut",
    "Grade",
    "Fonction",
    "Specialites",
    "Competences",
    "Regime",
    "TempsPartiel",
    "Engagement",
    "DateNaissance",
    "LieuNaissance",
    "DateEntreeSDIS",
    "DatePL",
    "DateVMA",
    "Telephone",
    "Email",
    "Adresse",
    "DispoSPV",
    "Commentaire"
];

/* ==========================================================================
   1. UTILITAIRES DE FORMATAGE, DATES & BADGES
   ========================================================================== */

function echapperHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formaterPrenom(str) {
    if (!str) return "";
    return str.trim().toLowerCase().replace(/(^|\s|-)\S/g, match => match.toUpperCase());
}


// Convertit JJ/MM/AAAA ou AAAA-MM-JJ vers AAAA-MM-JJ (pour les <input type="date">)
function formaterDatePourInput(dateStr) {
    if (!dateStr) return "";
    dateStr = dateStr.trim();
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Si c'est au format JJ/MM/AAAA
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return dateStr; // Déjà au format AAAA-MM-JJ
}

// Convertit n'importe quelle date valide vers le format Français JJ/MM/AAAA (pour le tableau)
function formaterDateFR(dateStr) {
    if (!dateStr) return "";
    const iso = formaterDatePourInput(dateStr);
    const parts = iso.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
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
    const isoDate = formaterDatePourInput(dateNaissanceStr);
    const dateNaissance = new Date(isoDate);
    if (isNaN(dateNaissance.getTime())) return "";

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

// Générateur de badges triés par ordre alphabétique
function genererBadgesTriés(chaineTxt, couleurBg = "#e2e8f0", couleurTexte = "#2d3748") {
    if (!chaineTxt || chaineTxt.trim() === "") return "-";

    let liste = chaineTxt.split(",")
        .map(item => item.trim())
        .filter(item => item.length > 0);

    liste.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

    return liste.map(badge => {
        const txtUpper = badge.toUpperCase();
        let bg = couleurBg;
        let txt = couleurTexte;

        // --- PERSONNALISATION DES COULEURS SELON LE VALEUR ---
        
        // 1. Temps plein / Complet
        if (txtUpper === "COMPLET") {
            bg = "#05fb5287";
            txt = "#058148";
        } 

        else if (txtUpper === "100%") {
            bg = "#05fb5233";
            txt = "#058148";
        }
        // 2. Temps partiels (80%, 70%, 50%, etc.)
        else if (/^\d{2,3}\s*%$/.test(badge)) { 
            bg = "#feebc8"; 
            txt = "#744210";
        } 
        // 3. Spécialités / Statuts SUAP
        else if (txtUpper === "SUAP") {
            bg = "#f3bdd6"; 
            txt = "#f218c9";
        } 
        else if (txtUpper === "SUAP/PPABE") {
            bg = "#f39927"; 
            txt = "#542b01";
        } 
        // 4. Indisponibilité / Dispo
        else if (txtUpper === "EN DISPO" || txtUpper === "DISPO") {
            bg = "#ff6363"; 
            txt = "#ffffff";
        }

        return `<span style="background:${bg}; color:${txt}; padding:2px 6px; border-radius:4px; font-size:0.75em; font-weight:bold; margin-right:3px; display:inline-block; margin-bottom:2px;">
            ${echapperHTML(badge)}
        </span>`;
    }).join("");
}


// Vérifie si la date VMA date de 10 mois ou plus
function doitRenouvelerVMA(dateVMAStr) {
    if (!dateVMAStr) return false;
    const isoDate = formaterDatePourInput(dateVMAStr);
    const dateVMA = new Date(isoDate);
    if (isNaN(dateVMA.getTime())) return false;
    const aujourdhui = new Date();
    const moisEcoules = (aujourdhui.getFullYear() - dateVMA.getFullYear()) * 12 + (aujourdhui.getMonth() - dateVMA.getMonth());
    return moisEcoules >= 10; // Délai d'alerte 10 mois
}

function doitRenouvelerPL(datePLStr) {
    if (!datePLStr) return false;
    const isoDate = formaterDatePourInput(datePLStr);
    const datePL = new Date(isoDate);
    if (isNaN(datePL.getTime())) return false;
    const aujourdhui = new Date();
    const moisEcoules = (aujourdhui.getFullYear() - datePL.getFullYear()) * 12 + (aujourdhui.getMonth() - datePL.getMonth());
    return moisEcoules >= 54; // Délai d'alerte 54 mois
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

    const dateEntree = new Date(formaterDatePourInput(dateEntreeStr));
    const dateNaissance = new Date(formaterDatePourInput(dateNaissanceStr));
    
    if (isNaN(dateNaissance.getTime()) || isNaN(dateEntree.getTime())) {
        return { g24: 0, g12: 0 };
    }

    // --- CALCUL DE L'ÂGE AU 31/12 DE L'ANNÉE EN COURS ---
    const anneeEnCours = new Date().getFullYear();
    const age = anneeEnCours - dateNaissance.getFullYear();

    // Condition Liste 2
    const estListe2 = (dateEntree < new Date("2013-10-01") && dateNaissance <= new Date("1976-12-31"));

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

    // Récupération des filtres existants (avec id rh_)
    const fSexe = document.getElementById("rh_sexe") ? document.getElementById("rh_sexe").value : "";
    const fEquipe = document.getElementById("rh_equipe") ? document.getElementById("rh_equipe").value : "";
    const fStatut = document.getElementById("rh_statut") ? document.getElementById("rh_statut").value : "";
    const fRecherche = document.getElementById("rh_recherche") ? document.getElementById("rh_recherche").value.toLowerCase().trim() : "";

    // Récupération des nouveaux filtres
    const fGrade = document.getElementById("filtreGrade") ? document.getElementById("filtreGrade").value : "";
    const fFonction = document.getElementById("filtreFonction") ? document.getElementById("filtreFonction").value : "";
    const fRegime = document.getElementById("filtreRegime") ? document.getElementById("filtreRegime").value : "";
    const fEngagement = document.getElementById("filtreEngagement") ? document.getElementById("filtreEngagement").value : "";
    
    const fSpec = document.getElementById("rechercheSpecialite") ? document.getElementById("rechercheSpecialite").value.toLowerCase().trim() : "";
    const fComp = document.getElementById("rechercheCompetence") ? document.getElementById("rechercheCompetence").value.toLowerCase().trim() : "";

    // Filtrage des agents
    let agentsFiltres = listeAgents.filter(agent => {
        if (fSexe && agent.sexe !== fSexe) return false;
        if (fEquipe && agent.equipe !== fEquipe) return false;
        if (fStatut && agent.statut !== fStatut) return false;
        if (fGrade && agent.grade !== fGrade) return false;
        if (fFonction && agent.fonction !== fFonction) return false;
        if (fRegime && agent.regime !== fRegime) return false;

        // Filtre Temps Partiel ou Engagement selon le statut
        if (fEngagement) {
            const valeurAgent = (agent.statut === "SPV") ? agent.engagement : agent.tempsPartiel;
            if (valeurAgent !== fEngagement) return false;
        }

        // Recherche globale (Nom, Prénom, Matricule)
        if (fRecherche) {
            const terme = `${agent.matricule || ''} ${agent.nom || ''} ${agent.prenom || ''}`.toLowerCase();
            if (!terme.includes(fRecherche)) return false;
        }

        // Recherche dans les Spécialités (ex: "COD6")
        if (fSpec) {
            const specs = (agent.specialites || "").toLowerCase();
            if (!specs.includes(fSpec)) return false;
        }

        // Recherche dans les Compétences (ex: "EAP")
        if (fComp) {
            const comps = (agent.competences || "").toLowerCase();
            if (!comps.includes(fComp)) return false;
        }

        return true;
    });

    // Tri alphabétique Nom puis Prénom
    agentsFiltres.sort((a, b) => {
        const nomA = (a.nom || "").toUpperCase();
        const nomB = (b.nom || "").toUpperCase();
        const compNom = nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
        
        if (compNom === 0) {
            const prenomA = (a.prenom || "").toLowerCase();
            const prenomB = (b.prenom || "").toLowerCase();
            return prenomA.localeCompare(prenomB, 'fr', { sensitivity: 'base' });
        }
        
        return compNom;
    });

    // Mise à jour du compteur d'agents
    const compteur = document.getElementById("compteurAgentsRH");
    if (compteur) compteur.innerText = `${agentsFiltres.length} / ${listeAgents.length} agent(s)`;

    agentsFiltres.forEach(agent => {
        let tpEngagement = "-";
        if (agent.statut === "SPV") {
            tpEngagement = agent.engagement || "Complet";
        } else if (agent.statut === "SPP") {
            tpEngagement = agent.tempsPartiel || "100%";
                           }

        let coords = [];
        if (agent.telephone) coords.push(echapperHTML(agent.telephone));
        if (agent.email) coords.push(echapperHTML(agent.email));
        if (agent.adresse) coords.push(echapperHTML(agent.adresse.toUpperCase()));
        let coordsText = coords.join("<br>") || "-";

        // VERIFICATION SI L'AGENT EST SELECTIONNE DANS LE FORMULAIRE
        const estSelectionne = (typeof agentSelectionneId !== 'undefined' && agent.id === agentSelectionneId);
        
        // Style conditionnel selon la sélection
        const styleLigne = estSelectionne 
            ? "cursor:pointer; background-color: #dce7f3; border-bottom:2px solid #2b6cb0; font-weight: 500;" 
            : "cursor:pointer; border-bottom:1px solid #e2e8f0;";

        // --- CALCUL DES BADGES DE RENOUVELLEMENT ---
        const badgeVMA = doitRenouvelerVMA(agent.dateVMA) 
            ? `<span style="background-color: none; border: 1px solid #ff1493; color: #ff1493; padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: bold;">🩺 VMA</span>` 
            : '';

        const badgePL = doitRenouvelerPL(agent.datePL) 
            ? `<span style="background-color: none; border: 1px solid #8a2be2; color: #8a2be2; padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: bold;">🚒 Permis</span>` 
            : '';

        const ligneAlertes = (badgeVMA || badgePL) 
            ? `<br><div style="margin-top: 3px; display: flex; align-items: center; gap: 4px;">${badgeVMA}${badgePL}</div>` 
            : '';

        corps.innerHTML += `
            <tr style="${styleLigne}" onclick="editerAgent(${agent.id})">
                <td style="padding: 6px 8px;">${echapperHTML(agent.matricule)}</td>
                <td style="padding: 6px 8px;">
                    <strong>${echapperHTML(agent.nom)}</strong> ${echapperHTML(agent.prenom)}
                    ${ligneAlertes}
                </td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.sexe || 'Homme')}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.equipe)}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.statut)}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.grade) || '-'}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.fonction) || '-'}</td>
                <td style="padding: 6px 8px;">${genererBadgesTriés(agent.specialites, "#ebf8ff", "#2b6cb0")}</td>
                <td style="padding: 6px 8px;">${genererBadgesTriés(agent.competences, "#edf2f7", "#4a5568")}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.regime)}</td>
                <td style="padding: 6px 8px;">${genererBadgesTriés(tpEngagement)}</td>
                <td style="padding: 6px 8px;"><strong>${obtenirGardesTheoriques(agent)}</strong></td>
                <td style="padding: 6px 8px;">${formaterDateFR(agent.datePL) || '-'}</td>
                <td style="padding: 6px 8px;">${formaterDateFR(agent.dateVMA) || '-'}</td>
                <td style="padding: 6px 8px;">${formaterDateFR(agent.entreeSdis) || '-'}</td>
                <td style="padding: 6px 8px;">${formaterDateFR(agent.naissanceDate) || '-'}${calculerAge(agent.naissanceDate)}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.lieuNaissance) || '-'}</td>
                <td style="padding: 6px 8px; font-size: 0.85em;">${coordsText}</td>
                <td style="padding: 6px 8px;">${echapperHTML(agent.commentaire) || '-'}</td>
            </tr>`;
    });
}

function reinitialiserFiltres() {
    const ids = [
        "rh_sexe", "rh_equipe", "rh_statut", "rh_recherche",
        "filtreGrade", "filtreFonction", "filtreRegime", "filtreEngagement",
        "rechercheSpecialite", "rechercheCompetence"
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    actualiserTableauRH();
}

let agentSelectionneId = null;
function editerAgent(id) {
    const agent = listeAgents.find(a => a.id === id);
    if (!agent) return;
    agentSelectionneId = id;

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
    document.getElementById("agentTempsPartiel").value =
                agent.tempsPartiel !== undefined &&
                agent.tempsPartiel !== null &&
                agent.tempsPartiel !== ""
                ? agent.tempsPartiel
                : 1;
    document.getElementById("agentEngagement").value = agent.engagement || "Complet";
    document.getElementById("agentDatePL").value = formaterDatePourInput(agent.datePL);
    document.getElementById("agentDateVMA").value = formaterDatePourInput(agent.dateVMA);
    document.getElementById("agentEntreeSdis").value = formaterDatePourInput(agent.entreeSdis);
    document.getElementById("agentNaissanceDate").value = formaterDatePourInput(agent.naissanceDate);
    document.getElementById("agentLieuNaissance").value = agent.lieuNaissance || "";
    
    document.getElementById("agentTelephone").value = agent.telephone || "";
    document.getElementById("agentEmail").value = agent.email || "";
    document.getElementById("agentAdresse").value = agent.adresse || "";

    if (document.getElementById("formSpecialites")) document.getElementById("formSpecialites").value = agent.specialites || "";
    if (document.getElementById("formCompetences")) document.getElementById("formCompetences").value = agent.competences || "";
    document.getElementById("agentCommentaire").value = agent.commentaire || "";

    adapterFormulaireSelonStatut();
    mettreAJourAffichageAge();
    actualiserIndicateurGardes();
    actualiserTableauRH();
    document.getElementById("btnSupprimerAgent").style.display = "inline-block";
}

function viderFormulaireRH() {
agentSelectionneId = null;
   document.getElementById("formRH").reset();
    document.getElementById("agentId").value = "";
    document.getElementById("btnSupprimerAgent").style.display = "none";
    adapterFormulaireSelonStatut();
    mettreAJourAffichageAge();
    actualiserIndicateurGardes();
    actualiserTableauRH();
}

function enregistrerAgent() {
    const idVal = document.getElementById("agentId").value;
    const currentId = idVal ? parseInt(idVal) : null;

    const matricule = document.getElementById("agentMatricule").value.trim();
    const nom = document.getElementById("agentNom").value.trim().toUpperCase();
    const prenom = formaterPrenom(document.getElementById("agentPrenom").value);

    // 1. Validation des champs obligatoires
    if (!matricule || !nom || !prenom) {
        alert("⚠️ Champs obligatoires manquants (Matricule, Nom, Prénom).");
        return;
    }

    // 2. Vérification des doublons de Matricule
    const doublonMatricule = listeAgents.find(a => 
        a.id !== currentId && 
        a.matricule.toLowerCase() === matricule.toLowerCase()
    );
    if (doublonMatricule) {
        alert(`❌ Erreur : Le matricule "${matricule}" est déjà attribué à l'agent ${doublonMatricule.nom} ${doublonMatricule.prenom}.`);
        return;
    }

    // 3. Vérification des doublons Nom + Prénom
    const doublonNomPrenom = listeAgents.find(a => 
        a.id !== currentId && 
        a.nom.toUpperCase() === nom.toUpperCase() && 
        a.prenom.toLowerCase() === prenom.toLowerCase()
    );
    if (doublonNomPrenom) {
        alert(`❌ Erreur : Un agent nommé "${nom} ${prenom}" existe déjà dans la base (Matricule : ${doublonNomPrenom.matricule}).`);
        return;
    }

    // 4. Création / Mise à jour de l'objet Agent
    let agentObj = {
        id: currentId || Date.now(),
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
        specialites: document.getElementById("formSpecialites") ? document.getElementById("formSpecialites").value.trim() : "",
        competences: document.getElementById("formCompetences") ? document.getElementById("formCompetences").value.trim() : "",
        commentaire: document.getElementById("agentCommentaire").value.trim()
    };

    if (currentId) {
        const idx = listeAgents.findIndex(a => a.id === currentId);
        if (idx !== -1) listeAgents[idx] = agentObj;
    } else {
        listeAgents.push(agentObj);
    }
      localStorage.setItem("baseAgents", JSON.stringify(listeAgents));

    actualiserTableauRH();
    viderFormulaireRH();
}

async function enregistrerAgentEtSauvegarder() {
    // Enregistre d'abord les modifications dans listeAgents
    enregistrerAgent();

    // Si enregistrerAgent() a refusé la saisie, on ne sauvegarde pas
    if (!window.fileHandleReseau || !classeurXLSX) {
        alert(
            "⚠️ Les données ont été modifiées dans la page, " +
            "mais aucun fichier FMPA-RH.xlsx n'est chargé.\n\n" +
            "Ouvrez d'abord le fichier Excel."
        );
        return;
    }

    // Sauvegarde dans FMPA-RH.xlsx
    await enregistrerFichierReseau();
}


function supprimerAgent() {
    const idVal = document.getElementById("agentId").value;
    if (!idVal) return;

    if (confirm("❓ Êtes-vous sûr de vouloir supprimer cet agent ?")) {

        const id = parseInt(idVal);

        const index = listeAgents.findIndex(a => a.id === id);

        if (index !== -1) {
            listeAgents.splice(index, 1);
        }

        // 💾 Mise à jour du localStorage
        localStorage.setItem("baseAgents", JSON.stringify(listeAgents));

        actualiserTableauRH();
        viderFormulaireRH();
    }
}

/* ==========================================================================
   5. LIEN AVEC FMPA-RH.xlsx — ONGLET baseAgents
   ========================================================================== */

const NOM_ONGLET_BASE_AGENTS = "baseAgents";

function normaliserValeurExcel(valeur) {
    if (valeur === null || valeur === undefined) return "";

    if (typeof valeur === "string") {
        return valeur.trim();
    }

    return String(valeur).trim();
}


// Convertit les dates Excel éventuelles en AAAA-MM-JJ
function normaliserDateExcel(valeur) {
    if (
        valeur === null ||
        valeur === undefined ||
        valeur === ""
    ) {
        return "";
    }

    // Date JavaScript
    if (
        valeur instanceof Date &&
        !isNaN(valeur.getTime())
    ) {
        const annee = valeur.getFullYear();
        const mois = String(
            valeur.getMonth() + 1
        ).padStart(2, "0");

        const jour = String(
            valeur.getDate()
        ).padStart(2, "0");

        return `${annee}-${mois}-${jour}`;
    }

    // Numéro de série Excel
    if (
        typeof valeur === "number" &&
        typeof XLSX !== "undefined" &&
        XLSX.SSF
    ) {
        try {
            const date =
                XLSX.SSF.parse_date_code(valeur);

            if (
                date &&
                date.y &&
                date.m &&
                date.d
            ) {
                return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
            }

        } catch (e) {
            console.warn(
                "Date Excel non interprétable :",
                valeur,
                e
            );
        }
    }

    return formaterDatePourInput(
        String(valeur)
    );
}


// Affichage de l'état du fichier Excel
function mettreAJourStatutExcel(
    message,
    couleur = "#475569"
) {
    const el =
        document.getElementById("statusReseau");

    if (!el) return;

    el.innerText = message;
    el.style.color = couleur;
}


// Affichage du nombre d'agents chargés
function mettreAJourCompteurExcel() {

    const el =
        document.getElementById("statusReseau");

    if (
        !el ||
        !window.fileHandleReseau
    ) {
        return;
    }

    el.innerText =
        `🟢 ${nomFichierXLSX || "FMPA-RH.xlsx"} chargé — ${listeAgents.length} agent(s)`;

    el.style.color = "#16803c";
}


// Vérifie que SheetJS est disponible
function verifierSheetJS() {

    if (typeof XLSX === "undefined") {

        alert(
            "❌ La bibliothèque SheetJS n'est pas chargée.\n\n" +
            "Ajoutez SheetJS dans index.html avant script.js."
        );

        return false;
    }

    return true;
}


// Vérifie les 23 colonnes attendues
function verifierColonnesBaseAgents(
    ligneEntete
) {

    if (!Array.isArray(ligneEntete)) {
        return false;
    }

    const entetes =
        ligneEntete.map(
            valeur => normaliserValeurExcel(valeur)
        );

    const manquantes =
        HEADERS_BASE_AGENTS.filter(
            header =>
                !entetes.includes(header)
        );

    if (manquantes.length > 0) {

        alert(
            "❌ L'onglet baseAgents ne possède pas les colonnes attendues.\n\n" +
            "Colonnes manquantes :\n" +
            manquantes.join(", ")
        );

        return false;
    }

    return true;
}


// Recherche la position d'une colonne
function trouverIndexEntete(
    entetes,
    nom
) {

    return entetes.findIndex(
        header =>
            normaliserValeurExcel(header) === nom
    );
}


// Lit l'onglet baseAgents
function lireAgentsDepuisFeuille(
    feuille
) {

    const lignes =
        XLSX.utils.sheet_to_json(
            feuille,
            {
                header: 1,
                defval: "",
                raw: true,
                blankrows: false
            }
        );

    if (!lignes.length) {

        throw new Error(
            "L'onglet baseAgents est vide."
        );
    }

    const entetes =
        lignes[0].map(
            valeur =>
                normaliserValeurExcel(valeur)
        );

    if (
        !verifierColonnesBaseAgents(
            entetes
        )
    ) {
        throw new Error(
            "Colonnes de baseAgents invalides."
        );
    }

    const index = {};

    HEADERS_BASE_AGENTS.forEach(
        nom => {
            index[nom] =
                trouverIndexEntete(
                    entetes,
                    nom
                );
        }
    );

    const agents = [];

    for (
        let i = 1;
        i < lignes.length;
        i++
    ) {

        const ligne =
            lignes[i] || [];

        const matricule =
            normaliserValeurExcel(
                ligne[index.Matricule]
            );

        // Ignore les lignes complètement vides
        if (!matricule) {
            continue;
        }

        agents.push({

            // Identifiant interne à la page
            // NON enregistré dans Excel
            id: Date.now() + i,

            matricule: matricule,

            sexe:
                normaliserValeurExcel(
                    ligne[index.Sexe]
                ) || "Homme",

            nom:
                normaliserValeurExcel(
                    ligne[index.Nom]
                ).toUpperCase(),

            prenom:
                formaterPrenom(
                    normaliserValeurExcel(
                        ligne[index.Prenom]
                    )
                ),

            equipe:
                normaliserValeurExcel(
                    ligne[index.Equipe]
                ) || "Equipe A",

            statut:
                normaliserValeurExcel(
                    ligne[index.Statut]
                ) || "SPP",

            grade:
                normaliserValeurExcel(
                    ligne[index.Grade]
                ),

            fonction:
                normaliserValeurExcel(
                    ligne[index.Fonction]
                ) || "Equ",

            specialites:
                normaliserValeurExcel(
                    ligne[index.Specialites]
                ),

            competences:
                normaliserValeurExcel(
                    ligne[index.Competences]
                ),

            regime:
                normaliserValeurExcel(
                    ligne[index.Regime]
                ) || "G24",

            tempsPartiel:
    ligne[index.TempsPartiel] !== "" &&
    ligne[index.TempsPartiel] !== null &&
    ligne[index.TempsPartiel] !== undefined
        ? Number(ligne[index.TempsPartiel])
        : 1,

            engagement:
                normaliserValeurExcel(
                    ligne[index.Engagement]
                ) || "Complet",

            naissanceDate:
                normaliserDateExcel(
                    ligne[index.DateNaissance]
                ),

            lieuNaissance:
                normaliserValeurExcel(
                    ligne[index.LieuNaissance]
                ).toUpperCase(),

            entreeSdis:
                normaliserDateExcel(
                    ligne[index.DateEntreeSDIS]
                ),

            datePL:
                normaliserDateExcel(
                    ligne[index.DatePL]
                ),

            dateVMA:
                normaliserDateExcel(
                    ligne[index.DateVMA]
                ),

            telephone:
                formaterTelephone(
                    normaliserValeurExcel(
                        ligne[index.Telephone]
                    )
                ),

            email:
                normaliserValeurExcel(
                    ligne[index.Email]
                ),

            adresse:
                normaliserValeurExcel(
                    ligne[index.Adresse]
                ).toUpperCase(),

            dispoSPV:
                normaliserValeurExcel(
                    ligne[index.DispoSPV]
                ),

            commentaire:
                normaliserValeurExcel(
                    ligne[index.Commentaire]
                )
        });
    }

    return agents;
}


// Ouvre FMPA-RH.xlsx
async function connecterFichierReseau() {

    if (!verifierSheetJS()) {
        return;
    }

    // File System Access API
    // Compatible Edge / Chrome
    if (!window.showOpenFilePicker) {

        alert(
            "❌ Votre navigateur ne prend pas en charge " +
            "l'ouverture directe des fichiers Excel.\n\n" +
            "Utilisez Microsoft Edge ou Google Chrome."
        );

        return;
    }

    try {

        const handles =
            await window.showOpenFilePicker({

                types: [
                    {
                        description:
                            "Classeur Excel FMPA-RH",

                        accept: {
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                                [".xlsx"]
                        }
                    }
                ],

                multiple: false
            });

        window.fileHandleReseau =
            handles[0];

        const file =
            await window.fileHandleReseau.getFile();

        nomFichierXLSX =
            file.name || "FMPA-RH.xlsx";

        const buffer =
            await file.arrayBuffer();

        classeurXLSX =
            XLSX.read(
                buffer,
                {
                    type: "array",
                    cellDates: true
                }
            );


        // Vérification de l'onglet
        if (
            !classeurXLSX.SheetNames.includes(
                NOM_ONGLET_BASE_AGENTS
            )
        ) {

            throw new Error(
                `L'onglet "${NOM_ONGLET_BASE_AGENTS}" est introuvable dans ${nomFichierXLSX}.`
            );
        }


        // Lecture de baseAgents
        const feuilleBaseAgents =
            classeurXLSX.Sheets[
                NOM_ONGLET_BASE_AGENTS
            ];

        listeAgents =
            lireAgentsDepuisFeuille(
                feuilleBaseAgents
            );


        agentSelectionneId = null;

        actualiserTableauRH();
        viderFormulaireRH();


        mettreAJourStatutExcel(
            `🟢 ${nomFichierXLSX} chargé — ${listeAgents.length} agent(s)`,
            "#16803c"
        );


        alert(
            `Chargement réussi : ${listeAgents.length} agent(s) importé(s) depuis l'onglet ${NOM_ONGLET_BASE_AGENTS}.`
        );

    }

    catch (err) {

        // Annulation de la fenêtre
        if (
            err &&
            err.name === "AbortError"
        ) {
            return;
        }

        console.error(
            "Erreur d'ouverture du classeur Excel :",
            err
        );

        window.fileHandleReseau = null;
        classeurXLSX = null;

        mettreAJourStatutExcel(
            "🔴 Erreur : fichier Excel non chargé",
            "#c53030"
        );

        alert(
            "❌ Impossible de charger FMPA-RH.xlsx.\n\n" +
            (err.message || err)
        );
    }
}


// Transforme un agent JS en ligne Excel
function convertirAgentEnLigneExcel(
    agent
) {

    return [

        agent.matricule || "",
        agent.sexe || "Homme",
        agent.nom || "",
        agent.prenom || "",
        agent.equipe || "",
        agent.statut || "",
        agent.grade || "",
        agent.fonction || "",
        agent.specialites || "",
        agent.competences || "",
        agent.regime || "",
        agent.tempsPartiel || "",
        agent.engagement || "",
        agent.naissanceDate || "",
        agent.lieuNaissance || "",
        agent.entreeSdis || "",
        agent.datePL || "",
        agent.dateVMA || "",
        agent.telephone || "",
        agent.email || "",
        agent.adresse || "",
        agent.dispoSPV || "",
        agent.commentaire || ""
    ];
}


// Enregistre uniquement l'onglet baseAgents
async function enregistrerFichierReseau() {

    if (!verifierSheetJS()) {
        return false;
    }

    if (
        !window.fileHandleReseau ||
        !classeurXLSX
    ) {

        alert(
            "⚠️ Aucun fichier Excel chargé.\n\n" +
            "Cliquez d'abord sur « Ouvrir / Connecter »."
        );

        return false;
    }

    try {

        const options = {
            mode: "readwrite"
        };


        // Vérification de l'autorisation
        if (
            await window.fileHandleReseau
                .queryPermission(options)
            !== "granted"
        ) {

            if (
                await window.fileHandleReseau
                    .requestPermission(options)
                !== "granted"
            ) {

                alert(
                    "❌ Autorisation refusée pour modifier le fichier Excel."
                );

                return false;
            }
        }


        /*
         * IMPORTANT :
         *
         * On remplace UNIQUEMENT la feuille baseAgents.
         *
         * Les onglets :
         *   - catalogue
         *   - historiqueSuivi
         *
         * restent dans le classeur.
         */

        const donneesBaseAgents = [
            HEADERS_BASE_AGENTS
        ];

        listeAgents.forEach(
            agent => {

                donneesBaseAgents.push(
                    convertirAgentEnLigneExcel(
                        agent
                    )
                );
            }
        );


        const nouvelleFeuille =
            XLSX.utils.aoa_to_sheet(
                donneesBaseAgents
            );


        classeurXLSX.Sheets[
            NOM_ONGLET_BASE_AGENTS
        ] = nouvelleFeuille;


        // Sécurité supplémentaire :
        // on vérifie que l'onglet existe toujours.
        if (
            !classeurXLSX.SheetNames.includes(
                NOM_ONGLET_BASE_AGENTS
            )
        ) {

            classeurXLSX.SheetNames.push(
                NOM_ONGLET_BASE_AGENTS
            );
        }


        // Génération du nouveau fichier XLSX
        const buffer =
            XLSX.write(
                classeurXLSX,
                {
                    bookType: "xlsx",
                    type: "array",
                    compression: true
                }
            );


        // Écriture dans le fichier sélectionné
        const writable =
            await window.fileHandleReseau
                .createWritable();

        await writable.write(buffer);
        await writable.close();


        mettreAJourCompteurExcel();


        alert(
            `💾 ${nomFichierXLSX} sauvegardé avec succès.\n\n` +
            `Onglet « ${NOM_ONGLET_BASE_AGENTS} » : ` +
            `${listeAgents.length} agent(s).`
        );

        return true;

    }

    catch (err) {

        console.error(
            "Erreur lors de la sauvegarde du classeur Excel :",
            err
        );

        alert(
            "❌ Erreur de sauvegarde de FMPA-RH.xlsx :\n\n" +
            (err.message || err)
        );

        return false;
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


// Génère et affiche la liste des alertes Permis PL
function afficherListeAlertesPL() {
    const aRenouveler = listeAgents.filter(agent => doitRenouvelerPL(agent.datePL));

    if (aRenouveler.length === 0) {
        alert("🚒 Aucun permis PL à renouveler (tous les permis ont moins de 4,5 ans).");
        return;
    }

    // Tri par date la plus ancienne en premier
    aRenouveler.sort((a, b) => {
        const dateA = new Date(formaterDatePourInput(a.datePL) || '9999-12-31');
        const dateB = new Date(formaterDatePourInput(b.datePL) || '9999-12-31');
        return dateA - dateB;
    });

    let message = `🚒 LISTE DES PERMIS PL À RENOUVELER (${aRenouveler.length} agent(s)) :\n\n`;
    aRenouveler.forEach((agent, index) => {
        const dateFormatee = formaterDateFR(agent.datePL) || 'Inconnue';
        message += `${index + 1}. ${agent.nom.toUpperCase()} ${agent.prenom} - Date PL : ${dateFormatee}\n`;
    });

    alert(message);
}

// Génère et affiche la liste des alertes VMA
function afficherListeAlertesVMA() {
    const aRenouveler = listeAgents.filter(agent => doitRenouvelerVMA(agent.dateVMA));

    if (aRenouveler.length === 0) {
        alert("🩺 Aucune VMA à renouveler (toutes les VMA ont moins de 10 mois).");
        return;
    }

    // Tri par date la plus ancienne en premier
    aRenouveler.sort((a, b) => {
        const dateA = new Date(formaterDatePourInput(a.dateVMA) || '9999-12-31');
        const dateB = new Date(formaterDatePourInput(b.dateVMA) || '9999-12-31');
        return dateA - dateB;
    });

    let message = `🩺 LISTE DES VMA À RENOUVELER (${aRenouveler.length} agent(s)) :\n\n`;
    aRenouveler.forEach((agent, index) => {
        const dateFormatee = formaterDateFR(agent.dateVMA) || 'Inconnue';
        message += `${index + 1}. ${agent.nom.toUpperCase()} ${agent.prenom} - Date VMA : ${dateFormatee}\n`;
    });

    alert(message);
}
