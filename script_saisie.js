let tableauAgentsRH = [];
let catalogueInitial = [];
let historiqueSaisiesFMPA = [];
let cumulHeuresParAgent = {};
let agentsSelectionnes = new Set();

let classeurXLSX = null;
let fichierHandleXLSX = null;
let nomFichierXLSX = "FMPA-RH.xlsx";

const HEADERS_HISTORIQUE = [
    "Matricule",
    "Date",
    "HeureDebut",
    "HeureFin",
    "Formation",
    "Formateur",
    "Commentaires",
    "DateSaisie"
];

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("saisie-date");
    if (dateInput) dateInput.valueAsDate = new Date();

    afficherMessageAccueil();

    document.getElementById("btn-open-xlsx")?.addEventListener("click", ouvrirFichierXLSX);
    document.getElementById("file-input-xlsx")?.addEventListener("change", importerXLSXFallback);

    document.getElementById("filter-equipe")?.addEventListener("change", filtrerEtAfficherTableau);
    document.getElementById("filter-statut")?.addEventListener("change", filtrerEtAfficherTableau);
    document.getElementById("filter-search")?.addEventListener("input", filtrerEtAfficherTableau);
    document.getElementById("btn-reset-filters")?.addEventListener("click", reinitialiserFiltres);

    const hDebut = document.getElementById("saisie-heure-debut");
const hFin = document.getElementById("saisie-heure-fin");

if (hDebut && hFin) {
    // Calcule la durée uniquement quand la valeur change ou est modifiée
    hDebut.addEventListener("input", calculerDuree);
    hFin.addEventListener("input", calculerDuree);
}

    document.getElementById("saisie-activite")?.addEventListener("change", majListeThemes);
    document.getElementById("select-all")?.addEventListener("change", basculerToutSelectionner);
    document.getElementById("form-saisie-groupee")?.addEventListener("submit", validerSaisieGroupee);

    calculerDuree();
});

function afficherMessageAccueil() {
    const tbody = document.getElementById("tbody-agents");
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center; padding:40px; color:#64748b;">
                <div style="font-size:1.1rem; margin-bottom:8px;"><strong>Aucun fichier Excel chargé</strong></div>
                Cliquez sur <strong>📂 Ouvrir FMPA-RH.xlsx</strong>.
            </td>
        </tr>
    `;
}

async function ouvrirFichierXLSX() {
    try {
        if (!window.XLSX) {
            alert("La bibliothèque SheetJS n'est pas disponible.");
            return;
        }

        if ("showOpenFilePicker" in window) {
            const [handle] = await window.showOpenFilePicker({
                multiple: false,
                types: [{
                    description: "Classeur Excel FMPA-RH",
                    accept: {
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                        "application/vnd.ms-excel": [".xls"]
                    }
                }]
            });
            fichierHandleXLSX = handle;
            const file = await handle.getFile();
            nomFichierXLSX = file.name;
            await chargerClasseur(file);
        } else {
            document.getElementById("file-input-xlsx")?.click();
        }
    } catch (err) {
        if (err?.name !== "AbortError") {
            console.error(err);
            afficherStatut(`🔴 Erreur : ${err.message}`, true);
        }
    }
}

async function importerXLSXFallback(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fichierHandleXLSX = null;
    nomFichierXLSX = file.name;
    try {
        await chargerClasseur(file);
    } catch (err) {
        console.error(err);
        afficherStatut(`🔴 Erreur : ${err.message}`, true);
    } finally {
        e.target.value = "";
    }
}

async function chargerClasseur(file) {
    const buffer = await file.arrayBuffer();
    classeurXLSX = XLSX.read(buffer, { type: "array", cellDates: true });

    verifierOngletsObligatoires(classeurXLSX);

    tableauAgentsRH = convertirBaseAgents(classeurXLSX.Sheets.baseAgents);
    catalogueInitial = convertirCatalogue(classeurXLSX.Sheets.catalogue);
    historiqueSaisiesFMPA = convertirHistorique(classeurXLSX.Sheets.historiqueSuivi);

    reconstruireCumulsDepuisHistorique();
    agentsSelectionnes.clear();

    alimenterSelectFiltres();
    initialiserFiltresEtListes();
    filtrerEtAfficherTableau();

    afficherStatut(
        `🟢 ${nomFichierXLSX} chargé — ` +
        `${tableauAgentsRH.length} agent(s), ` +
        `${catalogueInitial.length} formation(s), ` +
        `${historiqueSaisiesFMPA.length} ligne(s) d'historique`
    );
}

function verifierOngletsObligatoires(wb) {
    const requis = ["baseAgents", "catalogue", "historiqueSuivi"];
    const manquants = requis.filter(nom => !wb.Sheets[nom]);
    if (manquants.length) throw new Error(`Onglet(s) manquant(s) : ${manquants.join(", ")}`);
}

function feuilleVersObjets(ws) {
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

function convertirBaseAgents(ws) {
    return feuilleVersObjets(ws)
        .filter(l => String(l.Matricule ?? "").trim() !== "")
        .filter(l => String(l.Statut ?? "").trim().toUpperCase() !== "PATS")
        .map((l, index) => {
            const matricule = String(l.Matricule).trim();
            return {
                id: matricule || `AG-${index + 1}`,
                matricule,
                sexe: valeurTexte(l.Sexe),
                nom: valeurTexte(l.Nom).toUpperCase(),
                prenom: valeurTexte(l.Prenom),
                equipe: valeurTexte(l.Equipe) || "Non affecté",
                statut: valeurTexte(l.Statut),
                grade: valeurTexte(l.Grade),
                fonction: valeurTexte(l.Fonction),
                specialites: convertirListe(l.Specialites),
                competences: convertirListe(l.Competences),
                engagement: valeurTexte(l.Engagement),
                regime: valeurTexte(l.Regime)
            };
        });
}

function convertirCatalogue(ws) {
    return feuilleVersObjets(ws)
        .filter(l => String(l.id ?? "").trim() !== "")
        .map(l => {
            const modulations = parserModulations(l.modulations);
            return {
                id: valeurTexte(l.id),
                type: valeurTexte(l.type),
                fmpa: valeurTexte(l.fmpa),
                activite: valeurTexte(l.activite),
                libelle: valeurTexte(l.libelle),
                quota: Number(l.quota) || 0,
                sequence: valeurTexte(l.sequence),
                modulations,
                profils: extraireProfilsDesModulations(modulations),
                dispenses: extraireDispensesDesModulations(modulations)
            };
        });
}

function parserModulations(valeur) {
    if (!valeur) return [];
    if (Array.isArray(valeur)) return valeur;
    if (typeof valeur === "object") return [valeur];

    const texte = String(valeur).trim();
    if (!texte) return [];

    if (texte.startsWith("[") || texte.startsWith("{")) {
        try {
            const parsed = JSON.parse(texte);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (_) {}
    }

    const result = [];
    const elements = texte.split(/[,;\n]/);

    elements.forEach(elt => {
        const partie = elt.trim();
        if (!partie) return;

        if (partie.includes(":")) {
            const [profil, rawQuota] = partie.split(":").map(s => s.trim());
            const quotaNum = Number(rawQuota);
            result.push({
                profil: profil.toUpperCase(),
                quota: isNaN(quotaNum) ? 0 : quotaNum,
                dispense: quotaNum === 0
            });
        } else {
            result.push({
                profil: partie.toUpperCase(),
                quota: 0,
                dispense: true
            });
        }
    });

    return result;
}

function extraireProfilsDesModulations(modulations) {
    return modulations.filter(m => m && m.profil).map(m => String(m.profil).trim()).filter(Boolean);
}

function extraireDispensesDesModulations(modulations) {
    return modulations.filter(m => m && (m.dispense === true || m.type === "dispense" || m.quota === 0)).map(m => String(m.profil || m.valeur || "").trim()).filter(Boolean);
}

function convertirHistorique(ws) {
    return feuilleVersObjets(ws)
        .filter(l => String(l.Matricule ?? "").trim() !== "")
        .map(l => ({
            matricule: valeurTexte(l.Matricule),
            date: normaliserDate(l.Date),
            heureDebut: normaliserHeure(l.HeureDebut),
            heureFin: normaliserHeure(l.HeureFin),
            formation: valeurTexte(l.Formation),
            formateur: valeurTexte(l.Formateur),
            commentaires: valeurTexte(l.Commentaires),
            dateSaisie: normaliserDateHeure(l.DateSaisie)
        }));
}

function valeurTexte(v) { return (v === null || v === undefined) ? "" : String(v).trim(); }

function convertirListe(valeur) {
    if (Array.isArray(valeur)) return valeur.map(v => String(v).trim()).filter(Boolean);
    return valeurTexte(valeur).split(/[,/;]/).map(v => v.trim()).filter(Boolean);
}

function normaliserDate(valeur) {
    if (valeur instanceof Date && !isNaN(valeur)) return valeur.toISOString().slice(0, 10);
    if (typeof valeur === "number") {
        const d = XLSX.SSF.parse_date_code(valeur);
        if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    const txt = valeurTexte(valeur);
    if (!txt) return "";
    const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    const fr = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
    return txt;
}

function normaliserHeure(valeur) {
    if (valeur instanceof Date && !isNaN(valeur)) {
        return `${String(valeur.getHours()).padStart(2, "0")}:${String(valeur.getMinutes()).padStart(2, "0")}`;
    }
    if (typeof valeur === "number") {
        const total = Math.round(valeur * 24 * 60);
        return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }
    return valeurTexte(valeur);
}

function normaliserDateHeure(valeur) {
    if (valeur instanceof Date && !isNaN(valeur)) {
        const pad = n => String(n).padStart(2, "0");
        return `${valeur.getFullYear()}-${pad(valeur.getMonth() + 1)}-${pad(valeur.getDate())} ${pad(valeur.getHours())}:${pad(valeur.getMinutes())}:${pad(valeur.getSeconds())}`;
    }
    return valeurTexte(valeur);
}

function alimenterSelectFiltres() {
    const selEq = document.getElementById("filter-equipe");
    if (selEq) {
        selEq.innerHTML = '<option value="">Toutes</option>';
        [...new Set(tableauAgentsRH.map(a => a.equipe).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr")).forEach(eq => {
            const opt = document.createElement("option");
            opt.value = opt.textContent = eq;
            selEq.appendChild(opt);
        });
    }

    const selSt = document.getElementById("filter-statut");
    if (selSt) {
        selSt.innerHTML = '<option value="">Tous</option>';
        [...new Set(tableauAgentsRH.map(a => a.statut).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr")).forEach(st => {
            const opt = document.createElement("option");
            opt.value = opt.textContent = st;
            selSt.appendChild(opt);
        });
    }
}

function initialiserFiltresEtListes() {
    const selectAct = document.getElementById("saisie-activite");
    if (selectAct) {
        selectAct.innerHTML = '<option value="">-- Choisir un domaine --</option>';
        [...new Set(catalogueInitial.map(item => item.activite).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "fr"))
            .forEach(act => {
                const opt = document.createElement("option");
                opt.value = opt.textContent = act;
                selectAct.appendChild(opt);
            });
        selectAct.disabled = catalogueInitial.length === 0;
    }

    const datalist = document.getElementById("liste-formateurs");
    if (datalist) {
        datalist.innerHTML = "";
        tableauAgentsRH.forEach(agent => {
            const opt = document.createElement("option");
            const gradeStr = agent.grade ? `${agent.grade} ` : "";
            opt.value = `${gradeStr}${agent.nom} ${agent.prenom}`.trim();
            datalist.appendChild(opt);
        });
    }
}

/* AFFICHAGE DE LA SÉQUENCE AU LIEU DE LA DURÉE */
function majListeThemes() {
    const activite = document.getElementById("saisie-activite").value;
    const selectTheme = document.getElementById("saisie-theme");
    selectTheme.innerHTML = '<option value="">-- Choisir une formation --</option>';

    if (!activite) {
        selectTheme.disabled = true;
        return;
    }

    const formations = catalogueInitial.filter(f => f.activite === activite).sort((a,b)=>a.libelle.localeCompare(b.libelle,"fr"));
    formations.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.id;
        const detailSeq = f.sequence ? ` - ${f.sequence}` : "";
        opt.textContent = `${f.libelle}${detailSeq}`;
        selectTheme.appendChild(opt);
    });
    selectTheme.disabled = formations.length === 0;
}

function calculerDuree() {
    const debut = document.getElementById("saisie-heure-debut")?.value;
    const fin = document.getElementById("saisie-heure-fin")?.value;
    const display = document.getElementById("duree-calculee");

    if (!debut || !fin) {
        if (display) display.textContent = "0.0 h";
        return 0;
    }

    const [hD, mD] = debut.split(":").map(Number);
    const [hF, mF] = fin.split(":").map(Number);

    let minutesTotal = (hF * 60 + mF) - (hD * 60 + mD);
    if (minutesTotal < 0) minutesTotal += 24 * 60;

    const heures = (minutesTotal / 60).toFixed(1);
    if (display) display.textContent = `${heures} h`;
    return parseFloat(heures);
}

function calculerDureeEntreHeures(debut, fin) {
    if (!debut || !fin) return 0;
    const d = String(debut).split(":").map(Number);
    const f = String(fin).split(":").map(Number);
    if (d.length < 2 || f.length < 2 || d.some(Number.isNaN) || f.some(Number.isNaN)) return 0;
    let min = (f[0] * 60 + f[1]) - (d[0] * 60 + d[1]);
    if (min < 0) min += 24 * 60;
    return min / 60;
}

/* CONTRÔLE DE CHEVAUCHEMENT D'HORAIRES */
function verifierChevauchementHoraire(matricule, dateSaisie, heureDebutSaisie, heureFinSaisie) {
    const convertMin = (hStr) => {
        const [h, m] = hStr.split(":").map(Number);
        return h * 60 + m;
    };

    const debutSaisie = convertMin(heureDebutSaisie);
    let finSaisie = convertMin(heureFinSaisie);
    if (finSaisie <= debutSaisie) finSaisie += 24 * 60;

    return historiqueSaisiesFMPA.find(row => {
        if (row.matricule !== matricule || row.date !== dateSaisie) return false;

        const debutExist = convertMin(row.heureDebut);
        let finExist = convertMin(row.heureFin);
        if (finExist <= debutExist) finExist += 24 * 60;

        // Condition de chevauchement strict : (Début1 < Fin2) ET (Fin1 > Début2)
        return (debutSaisie < finExist) && (finSaisie > debutExist);
    });
}

function filtrerEtAfficherTableau() {
    const eqFiltre = document.getElementById("filter-equipe").value;
    const stFiltre = document.getElementById("filter-statut")?.value || "";
    const recherche = document.getElementById("filter-search").value.toLowerCase().trim();

    const agentsFiltres = tableauAgentsRH.filter(agent => {
        const matchEquipe = !eqFiltre || agent.equipe === eqFiltre;
        const matchStatut = !stFiltre || agent.statut === stFiltre;
        const terme = `${agent.nom} ${agent.prenom} ${agent.matricule} ${agent.grade} ${agent.fonction}`.toLowerCase();
        const matchRecherche = !recherche || terme.includes(recherche);
        return matchEquipe && matchStatut && matchRecherche;
    });

    agentsFiltres.sort((a,b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
    afficherTableauAgents(agentsFiltres);
}

function reinitialiserFiltres() {
    document.getElementById("filter-equipe").value = "";
    document.getElementById("filter-statut").value = "";
    document.getElementById("filter-search").value = "";
    filtrerEtAfficherTableau();
}

function afficherTableauAgents(listeAgents) {
    const tbody = document.getElementById("tbody-agents");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (listeAgents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Aucun agent à afficher.</td></tr>';
        document.getElementById("count-badge").textContent = `0 / ${tableauAgentsRH.length} agent(s)`;
        majStatutSelection();
        return;
    }

    listeAgents.forEach(agent => {
        const idAgent = agent.id;
        const isChecked = agentsSelectionnes.has(idAgent) ? "checked" : "";
        
        const resSocle = genererAvancementSocle(agent);
        const resSpec = genererAvancementSpecialites(agent);

        const tr = document.createElement("tr");
        if (isChecked) tr.classList.add("selected-row");

        const gradeStr = agent.grade ? `${agent.grade} ` : "";
        const fonctionStr = agent.fonction ? ` (${agent.fonction})` : "";
        const agentLibelle = `${gradeStr}<strong>${escapeHtml(agent.nom)}</strong> ${escapeHtml(agent.prenom)}${escapeHtml(fonctionStr)}`;

        tr.innerHTML = `
            <td class="sticky-col col-chk">
                <input type="checkbox" class="chk-agent" value="${escapeHtml(idAgent)}" ${isChecked} onchange="toggleAgent('${escapeJs(idAgent)}')">
            </td>
            <td class="sticky-col col-agent">${agentLibelle}</td>
            <td class="sticky-col col-equipe">${escapeHtml(agent.equipe)}</td>
            <td><span class="badge-tag badge-statut">${escapeHtml(agent.statut || "-")}</span></td>
            <td class="col-avancement">${resSocle.html}</td>
            <td class="col-avancement">${resSpec.html}</td>
            <td class="col-total" style="color:#1e40af;">${resSocle.total} h</td>
            <td class="col-total" style="color:#0f172a;">${resSpec.total} h</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("count-badge").textContent = `${listeAgents.length} / ${tableauAgentsRH.length} agent(s)`;
    majStatutSelection();
}

function genererAvancementSocle(agent) {
    const idAgent = agent.id;
    const heuresAgent = cumulHeuresParAgent[idAgent] || {};
    const socleFormations = catalogueInitial.filter(f => String(f.type).toUpperCase().includes("SOCLE"));

    if (!socleFormations.length) return { html: `<span style="color:#64748b;">Catalogue non chargé</span>`, total: 0 };

    const profilsAgent = new Set([
        ...extraireValeurs(agent.statut),
        ...extraireValeurs(agent.grade),
        ...extraireValeurs(agent.fonction),
        ...extraireValeurs(agent.specialites),
        ...extraireValeurs(agent.competences),
        ...extraireValeurs(agent.engagement),
        ...extraireValeurs(agent.regime)
    ]);

    let totalHeures = 0;

    const itemsHtml = socleFormations.map(f => {
        let quotaRequis = Number(f.quota) || 0;
        let estDispense = false;

        if (Array.isArray(f.modulations) && f.modulations.length > 0) {
            const matchMod = f.modulations.find(m => {
                const profilMod = String(m.profil || "").trim().toUpperCase();
                return profilsAgent.has(profilMod);
            });

            if (matchMod) {
                if (matchMod.dispense === true || matchMod.quota === 0) {
                    estDispense = true;
                } else {
                    quotaRequis = Number(matchMod.quota);
                }
            }
        }

        if (estDispense || quotaRequis === 0) return null;

        const fait = heuresAgent[f.id] || heuresAgent[f.libelle] || 0;
        totalHeures += fait;
        const styleClass = fait >= quotaRequis ? "fma-done" : (fait > 0 ? "fma-partial" : "fma-todo");

        return `<span class="fma-item"><span style="color:#0284c7; font-weight:600;">${escapeHtml(f.libelle)} :</span> <span class="${styleClass}">${fait}/${quotaRequis}h</span></span>`;
    }).filter(Boolean);

    return {
        html: itemsHtml.join(" | ") || `<span style="color:#64748b;">Aucun socle requis</span>`,
        total: totalHeures
    };
}

function genererAvancementSpecialites(agent) {
    const specAgentBrutes = (agent.specialites || []).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!specAgentBrutes.length) return { html: `<span style="color:#94a3b8;">Aucune spé.</span>`, total: 0 };

    const specAgentBase = specAgentBrutes.map(s => s.replace(/\s*\d+$/, ""));
    const heuresAgent = cumulHeuresParAgent[agent.id] || {};

    const formationsSpec = catalogueInitial.filter(f => {
        const typeF = (f.type || "").toUpperCase();
        const activiteF = (f.activite || "").trim().toUpperCase();

        const estTypeSpec = typeF.includes("SPEC") || typeF.includes("SPÉCIALITÉ");
        const matchActivite = activiteF && specAgentBase.includes(activiteF);

        const profils = [
            ...(Array.isArray(f.profils) ? f.profils : []),
            ...extraireValeurs(f.modulations?.map(m => m?.profil).filter(Boolean) || [])
        ].map(v => String(v).trim().toUpperCase());

        const matchProfil = profils.some(p => specAgentBrutes.includes(p) || specAgentBase.includes(p));

        return estTypeSpec || matchActivite || matchProfil;
    });

    if (!formationsSpec.length) return { html: `<span style="color:#94a3b8;">Aucun suivi requis</span>`, total: 0 };

    let totalHeures = 0;

    const itemsHtml = formationsSpec.map(f => {
        const quotaRequis = Number(f.quota) || 0;
        if (!quotaRequis) return null;

        const fait = heuresAgent[f.id] || heuresAgent[f.libelle] || 0;
        totalHeures += fait;
        const styleClass = fait >= quotaRequis ? "fma-done" : (fait > 0 ? "fma-partial" : "fma-todo");

        return `<span class="fma-item"><span style="color:#8b5cf6; font-weight:600;">${escapeHtml(f.libelle)} :</span> <span class="${styleClass}">${fait}/${quotaRequis}h</span></span>`;
    }).filter(Boolean);

    return {
        html: itemsHtml.join(" | ") || `<span style="color:#64748b;">0/0h</span>`,
        total: totalHeures
    };
}

function extraireValeurs(champ) {
    if (!champ) return [];
    if (Array.isArray(champ)) {
        return champ.flatMap(v => String(v).split(/[,/;]/)).map(v => v.trim().toUpperCase()).filter(Boolean);
    }
    return String(champ).split(/[,/;]/).map(v => v.trim().toUpperCase()).filter(Boolean);
}

function reconstruireCumulsDepuisHistorique() {
    cumulHeuresParAgent = {};
    historiqueSaisiesFMPA.forEach(row => {
        const agent = tableauAgentsRH.find(a => a.matricule === row.matricule);
        if (!agent) return;

        const formation = trouverFormationHistorique(row.formation);
        if (!formation) return;

        const duree = calculerDureeEntreHeures(row.heureDebut, row.heureFin);
        if (duree <= 0) return;

        if (!cumulHeuresParAgent[agent.id]) cumulHeuresParAgent[agent.id] = {};
        const cle = formation.id || formation.libelle;
        cumulHeuresParAgent[agent.id][cle] = (cumulHeuresParAgent[agent.id][cle] || 0) + duree;
    });
}

function trouverFormationHistorique(valeur) {
    const texte = valeurTexte(valeur);
    return catalogueInitial.find(f => f.id === texte || f.libelle === texte);
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
    checkboxes.forEach(chk => {
        chk.checked = isChecked;
        if (isChecked) agentsSelectionnes.add(chk.value);
        else agentsSelectionnes.delete(chk.value);
    });
    filtrerEtAfficherTableau();
}

function majStatutSelection() {
    const count = agentsSelectionnes.size;
    document.getElementById("selection-status").textContent = `👥 ${count} agent(s) sélectionné(s)`;
    document.getElementById("btn-valider-groupe").disabled = count === 0 || !classeurXLSX;
}

/* REINITIALISATION COMPLÈTE DU FORMULAIRE */
function reinitialiserFormulaire() {
    document.getElementById("form-saisie-groupee")?.reset();
    
    // Remettre la date du jour
    const dateInput = document.getElementById("saisie-date");
    if (dateInput) dateInput.valueAsDate = new Date();

    // Reinitialiser les listes déroulantes dépendantes
    const selectAct = document.getElementById("saisie-activite");
    if (selectAct) selectAct.value = "";

    const selectTheme = document.getElementById("saisie-theme");
    if (selectTheme) {
        selectTheme.innerHTML = '<option value="">-- Choisir d\'abord un domaine --</option>';
        selectTheme.disabled = true;
    }

    calculerDuree();
}

/* VALIDATION AVEC CONTRÔLE DE CHEVAUCHEMENT ET RAZ FORMULAIRE */
async function validerSaisieGroupee(e) {
    e.preventDefault();

    if (!classeurXLSX) {
        alert("Ouvrez d'abord FMPA-RH.xlsx.");
        return;
    }

    const duree = calculerDuree();
    const dateFormation = document.getElementById("saisie-date").value;
    const heureDebut = document.getElementById("saisie-heure-debut").value;
    const heureFin = document.getElementById("saisie-heure-fin").value;
    const idFormation = document.getElementById("saisie-theme").value;
    const formateur = document.getElementById("saisie-formateur").value.trim();
    const commentaires = document.getElementById("saisie-commentaires").value.trim();

    if (!agentsSelectionnes.size) {
        alert("Veuillez sélectionner au moins un agent.");
        return;
    }

    if (!dateFormation || !idFormation || duree <= 0) {
        alert("Veuillez sélectionner une formation valide et renseigner les heures.");
        return;
    }

    const formationObj = catalogueInitial.find(f => f.id === idFormation);
    if (!formationObj) {
        alert("Formation non trouvée dans le catalogue.");
        return;
    }

    // --- VÉRIFICATION DES CHEVAUCHEMENTS D'HORAIRES ---
    const conflits = [];

    // 1. Pour les agents bénéficiaires
    agentsSelectionnes.forEach(idAgent => {
        const agent = tableauAgentsRH.find(a => a.id === idAgent);
        if (!agent) return;

        const conflit = verifierChevauchementHoraire(agent.matricule, dateFormation, heureDebut, heureFin);
        if (conflit) {
            conflits.push(`Agent : ${agent.nom} ${agent.prenom} (déjà inscrit à "${conflit.formation}" de ${conflit.heureDebut} à ${conflit.heureFin})`);
        }
    });

    // 2. Pour le formateur
    let agentFormateur = null;
    if (formateur) {
        agentFormateur = tableauAgentsRH.find(a => {
            const nomComplet = `${a.grade ? a.grade + ' ' : ''}${a.nom} ${a.prenom}`.toLowerCase();
            return nomComplet.includes(formateur.toLowerCase()) || `${a.nom} ${a.prenom}`.toLowerCase() === formateur.toLowerCase();
        });

        if (agentFormateur) {
            const conflitFormateur = verifierChevauchementHoraire(agentFormateur.matricule, dateFormation, heureDebut, heureFin);
            if (conflitFormateur) {
                conflits.push(`Formateur : ${agentFormateur.nom} ${agentFormateur.prenom} (déjà inscrit à "${conflitFormateur.formation}" de ${conflitFormateur.heureDebut} à ${conflitFormateur.heureFin})`);
            }
        }
    }

    if (conflits.length > 0) {
        alert("❌ Impossible d'enregistrer la saisie, chevauchement d'horaires détecté :\n\n" + conflits.join("\n"));
        return;
    }

    // --- ENREGISTREMENT DE LA SAISIE ---
    const dateSaisie = obtenirDateSaisie();

    agentsSelectionnes.forEach(idAgent => {
        const agent = tableauAgentsRH.find(a => a.id === idAgent);
        if (!agent) return;

        historiqueSaisiesFMPA.push({
            matricule: agent.matricule,
            date: dateFormation,
            heureDebut,
            heureFin,
            formation: formationObj.libelle,
            formateur,
            commentaires,
            dateSaisie
        });

        if (!cumulHeuresParAgent[idAgent]) cumulHeuresParAgent[idAgent] = {};
        const cle = formationObj.id;
        cumulHeuresParAgent[idAgent][cle] = (cumulHeuresParAgent[idAgent][cle] || 0) + duree;
    });

    if (agentFormateur && !agentsSelectionnes.has(agentFormateur.id)) {
        historiqueSaisiesFMPA.push({
            matricule: agentFormateur.matricule,
            date: dateFormation,
            heureDebut,
            heureFin,
            formation: formationObj.libelle,
            formateur: `${agentFormateur.nom} ${agentFormateur.prenom}`,
            commentaires: `${commentaires ? commentaires + ' — ' : ''}(Animation / Formateur)`,
            dateSaisie
        });

        if (!cumulHeuresParAgent[agentFormateur.id]) cumulHeuresParAgent[agentFormateur.id] = {};
        const cle = formationObj.id;
        cumulHeuresParAgent[agentFormateur.id][cle] = (cumulHeuresParAgent[agentFormateur.id][cle] || 0) + duree;
    }

    reconstruireFeuilleHistorique();

    const nombreAgents = agentsSelectionnes.size;
    agentsSelectionnes.clear();
    const selectAll = document.getElementById("select-all");
    if (selectAll) selectAll.checked = false;

    // Vider le formulaire de droite
    reinitialiserFormulaire();

    filtrerEtAfficherTableau();

    if (fichierHandleXLSX) {
        try {
            await enregistrerFichierXLSX();
            alert(`Saisie enregistrée et FMPA-RH.xlsx sauvegardé.\n${duree}h ajoutée(s) pour ${nombreAgents} agent(s).`);
        } catch (err) {
            console.error(err);
            alert(`Saisie enregistrée en mémoire mais échec d'écriture Excel :\n${err.message}`);
        }
    } else {
        alert(`Saisie enregistrée en mémoire.\nUtilisez la sauvegarde directe.`);
    }
}

function reconstruireFeuilleHistorique() {
    if (!classeurXLSX) return;
    const donnees = [
        HEADERS_HISTORIQUE,
        ...historiqueSaisiesFMPA.map(row => [
            row.matricule,
            row.date,
            row.heureDebut,
            row.heureFin,
            row.formation,
            row.formateur,
            row.commentaires,
            row.dateSaisie
        ])
    ];
    classeurXLSX.Sheets.historiqueSuivi = XLSX.utils.aoa_to_sheet(donnees);
}

async function enregistrerFichierXLSX() {
    if (!classeurXLSX) return;
    reconstruireFeuilleHistorique();

    const buffer = XLSX.write(classeurXLSX, { bookType: "xlsx", type: "array" });

    if (fichierHandleXLSX) {
        const writable = await fichierHandleXLSX.createWritable();
        try {
            await writable.write(buffer);
            await writable.close();
        } catch (err) {
            try { await writable.abort(); } catch (_) {}
            throw err;
        }
        afficherStatut(`🟢 ${nomFichierXLSX} sauvegardé — ${new Date().toLocaleTimeString("fr-FR")}`);
        return;
    }

    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomFichierXLSX || "FMPA-RH.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function obtenirDateSaisie() {
    const maintenant = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${maintenant.getFullYear()}-${pad(maintenant.getMonth() + 1)}-${pad(maintenant.getDate())} ${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}:${pad(maintenant.getSeconds())}`;
}

function afficherStatut(message, erreur = false) {
    const element = document.getElementById("xlsx-status");
    if (!element) return;
    element.textContent = message;
    element.style.background = erreur ? "#fee2e2" : "#f1f5f9";
    element.style.color = erreur ? "#991b1b" : "#475569";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Fonction pour le bouton Annuler Saisie
function annulerSaisie() {
    reinitialiserFormulaire();
    agentsSelectionnes.clear();
    const selectAll = document.getElementById("select-all");
    if (selectAll) selectAll.checked = false;
    filtrerEtAfficherTableau();
}


function escapeJs(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
