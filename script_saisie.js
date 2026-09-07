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

// --- GESTION DU MAPPING & CONSTANTES ADMIN ---
let indexEnEdition = null;
let estAdminDeverrouille = false;

// Empreinte SHA-256 par défaut si absente d'Excel ("1234")
const HASH_DEFAUT_SECOURS = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("saisie-date");
    if (dateInput) dateInput.valueAsDate = new Date();

    afficherMessageAccueil();

    document.getElementById('filter-module')?.addEventListener('input', genererFicheEquipe);
    document.getElementById('filter-recherche')?.addEventListener('input', genererFicheEquipe);

    document.getElementById("btn-open-xlsx")?.addEventListener("click", ouvrirFichierXLSX);
    document.getElementById("file-input-xlsx")?.addEventListener("change", importerXLSXFallback);

    document.getElementById("filter-equipe")?.addEventListener("change", filtrerEtAfficherTableau);
    document.getElementById("filter-statut")?.addEventListener("change", filtrerEtAfficherTableau);
    document.getElementById("filter-search")?.addEventListener("input", filtrerEtAfficherTableau);
    document.getElementById("btn-reset-filters")?.addEventListener("click", reinitialiserFiltres);

    const hDebut = document.getElementById("saisie-heure-debut");
    const hFin = document.getElementById("saisie-heure-fin");

    if (hDebut && hFin) {
        hDebut.addEventListener("input", calculerDuree);
        hFin.addEventListener("input", calculerDuree);
    }

    document.getElementById("saisie-activite")?.addEventListener("change", majListeThemes);
    document.getElementById("select-all")?.addEventListener("change", basculerToutSelectionner);
    document.getElementById("form-saisie-groupee")?.addEventListener("submit", validerSaisieGroupee);

    document.getElementById("hist-code-admin")?.addEventListener("input", verifierCodeAdmin);
    document.getElementById("hist-ref-wact")?.addEventListener("change", enregistrerChangementDateWact);

    calculerDuree();
});

function afficherMessageAccueil() {
    const tbody = document.getElementById("tbody-agents");
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align:left; padding:40px; color:#64748b; display: none">
                <div style="font-size:1.1rem; color: #bd1e1e; margin-bottom:8px;"><strong>Aucun fichier Excel chargé</strong></div>
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

    // --- LECTURE DE LA DATE RÉF W@CT DEPUIS L'ONGLET PARAMETRES ---
    if (classeurXLSX.Sheets["Parametres"]) {
        const sheetParam = classeurXLSX.Sheets["Parametres"];
        let valWact = null;

        if (sheetParam["B1"] && sheetParam["B1"].v !== undefined) {
            valWact = sheetParam["B1"].v;
        } else {
            const dataParam = XLSX.utils.sheet_to_json(sheetParam, { header: 1 });
            if (dataParam && dataParam[0] && dataParam[0][1] !== undefined) {
                valWact = dataParam[0][1];
            }
        }

        if (valWact) {
            const inputWact = document.getElementById("hist-ref-wact");
            if (inputWact) {
                const dateStr = valWact instanceof Date 
                    ? valWact.toISOString().slice(0, 10) 
                    : normaliserDate(valWact);
                inputWact.value = dateStr;
            }
        }
    }

    reconstruireCumulsDepuisHistorique();
    agentsSelectionnes.clear();

    alimenterSelectFiltres();
    initialiserFiltresEtListes();
    filtrerEtAfficherTableau();

    const btnOpen = document.getElementById("btn-open-xlsx");
    if (btnOpen) {
        btnOpen.classList.remove("btn-clignotant");
        btnOpen.classList.add("btn-connecte");
        btnOpen.innerHTML = "🌐 Réseau connecté";
    }

    afficherStatut(
        `⚡️${nomFichierXLSX} chargé — ` +
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

        return (debutSaisie < finExist) && (finSaisie > debutExist);
    });
}

function filtrerEtAfficherTableau() {
    const eqFiltre = document.getElementById("filter-equipe")?.value || "";
    const stFiltre = document.getElementById("filter-statut")?.value || "";
    const recherche = document.getElementById("filter-search")?.value.toLowerCase().trim() || "";

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
    if (document.getElementById("filter-equipe")) document.getElementById("filter-equipe").value = "";
    if (document.getElementById("filter-statut")) document.getElementById("filter-statut").value = "";
    if (document.getElementById("filter-search")) document.getElementById("filter-search").value = "";
    filtrerEtAfficherTableau();
}

function afficherTableauAgents(listeAgents) {
    const tbody = document.getElementById("tbody-agents");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (listeAgents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Aucun agent à afficher.</td></tr>';
        const countBadge = document.getElementById("count-badge");
        if (countBadge) countBadge.textContent = `0 / ${tableauAgentsRH.length} agent(s)`;
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
            <td class="col-total" style="color:#1e40af;">${resSocle.libelleTotal}</td>
            <td class="col-total" style="color:#0f172a;">${resSpec.libelleTotal}</td>
        `;
        tbody.appendChild(tr);
    });

    const countBadge = document.getElementById("count-badge");
    if (countBadge) countBadge.textContent = `${listeAgents.length} / ${tableauAgentsRH.length} agent(s)`;
    majStatutSelection();
}

function genererAvancementSocle(agent) {
    const idAgent = agent.id;
    const heuresAgent = cumulHeuresParAgent[idAgent] || {};
    const socleFormations = catalogueInitial.filter(f => String(f.type).toUpperCase().includes("SOCLE"));

    if (!socleFormations.length) {
        return { html: `<span style="color:#64748b;">Catalogue non chargé</span>`, totalUtile: 0, totalReel: 0, totalAFaire: 0, libelleTotal: "0 / 0 h" };
    }

    const profilsAgent = new Set([
        ...extraireValeurs(agent.statut),
        ...extraireValeurs(agent.grade),
        ...extraireValeurs(agent.fonction),
        ...extraireValeurs(agent.specialites),
        ...extraireValeurs(agent.competences),
        ...extraireValeurs(agent.engagement),
        ...extraireValeurs(agent.regime)
    ]);

    let totalUtile = 0;
    let totalReel = 0;
    let totalAFaire = 0;

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

        totalAFaire += quotaRequis;

        const faitReel = heuresAgent[f.id] || heuresAgent[f.libelle] || 0;
        const faitUtile = Math.min(faitReel, quotaRequis);

        totalReel += faitReel;
        totalUtile += faitUtile;

        const styleClass = faitUtile >= quotaRequis ? "fma-done" : (faitUtile > 0 ? "fma-partial" : "fma-todo");

        return `<span class="fma-item"><span style="color:#0284c7; font-weight:600;">${escapeHtml(f.libelle)} :</span> <span class="${styleClass}">${faitUtile}/${quotaRequis}h</span></span>`;
    }).filter(Boolean);

    let libelleTotal = `${totalUtile} / ${totalAFaire} h`;
    if (totalReel > totalUtile) {
        libelleTotal += ` <small style="color:#64748b; font-weight:normal; font-size:0.8em;">(réel : ${totalReel}h)</small>`;
    }

    return {
        html: itemsHtml.join(" | ") || `<span style="color:#64748b;">Aucun socle requis</span>`,
        totalUtile,
        totalReel,
        totalAFaire,
        libelleTotal
    };
}

function genererAvancementSpecialites(agent) {
    const specAgentBrutes = (agent.specialites || []).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!specAgentBrutes.length) {
        return { html: `<span style="color:#94a3b8;">Aucune spé.</span>`, totalUtile: 0, totalReel: 0, totalAFaire: 0, libelleTotal: "0 / 0 h" };
    }

    const specAgentBase = specAgentBrutes.map(s => s.replace(/\s*\d+$/, ""));
    const heuresAgent = cumulHeuresParAgent[agent.id] || {};

    const formationsSpec = catalogueInitial.filter(f => {
        const typeF = (f.type || "").trim().toUpperCase();
        
        const estSocle = typeF.includes("SOCLE") || typeF.includes("COMMUN");
        if (estSocle) return false;

        const activiteF = (f.activite || "").trim().toUpperCase();
        const estTypeSpec = typeF.includes("SPEC") || typeF.includes("SPÉCIALITÉ");

        const matchActivite = activiteF && specAgentBase.some(s => s === activiteF || activiteF.includes(s) || s.includes(activiteF));

        const profils = [
            ...(Array.isArray(f.profils) ? f.profils : []),
            ...extraireValeurs(f.modulations?.map(m => m?.profil).filter(Boolean) || [])
        ].map(v => String(v).trim().toUpperCase());

        const matchProfil = profils.some(p => specAgentBrutes.includes(p) || specAgentBase.includes(p));

        return (estTypeSpec || matchActivite || matchProfil) && (matchActivite || matchProfil);
    });

    if (!formationsSpec.length) {
        return { html: `<span style="color:#94a3b8;">Aucun suivi requis</span>`, totalUtile: 0, totalReel: 0, totalAFaire: 0, libelleTotal: "0 / 0 h" };
    }

    let totalUtile = 0;
    let totalReel = 0;
    let totalAFaire = 0;

    const itemsHtml = formationsSpec.map(f => {
        const quotaRequis = Number(f.quota) || 0;
        if (!quotaRequis) return null;

        totalAFaire += quotaRequis;

        const faitReel = heuresAgent[f.id] || heuresAgent[f.libelle] || 0;
        const faitUtile = Math.min(faitReel, quotaRequis);

        totalReel += faitReel;
        totalUtile += faitUtile;

        const styleClass = faitUtile >= quotaRequis ? "fma-done" : (faitUtile > 0 ? "fma-partial" : "fma-todo");

        return `<span class="fma-item"><span style="color:#8b5cf6; font-weight:600;">${escapeHtml(f.libelle)} :</span> <span class="${styleClass}">${faitUtile}/${quotaRequis}h</span></span>`;
    }).filter(Boolean);

    let libelleTotal = `${totalUtile} / ${totalAFaire} h`;
    if (totalReel > totalUtile) {
        libelleTotal += ` <small style="color:#64748b; font-weight:normal; font-size:0.8em;">(réel : ${totalReel}h)</small>`;
    }

    return {
        html: itemsHtml.join(" | ") || `<span style="color:#64748b;">0/0h</span>`,
        totalUtile,
        totalReel,
        totalAFaire,
        libelleTotal
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
    const statusEl = document.getElementById("selection-status");
    const btnValider = document.getElementById("btn-valider-groupe");
    if (statusEl) statusEl.textContent = `👥 ${count} agent(s) sélectionné(s)`;
    if (btnValider) btnValider.disabled = count === 0 || !classeurXLSX;
}

function reinitialiserFormulaire() {
    document.getElementById("form-saisie-groupee")?.reset();
    
    const dateInput = document.getElementById("saisie-date");
    if (dateInput) dateInput.valueAsDate = new Date();

    const selectAct = document.getElementById("saisie-activite");
    if (selectAct) selectAct.value = "";

    const selectTheme = document.getElementById("saisie-theme");
    if (selectTheme) {
        selectTheme.innerHTML = '<option value="">-- Choisir d\'abord un domaine --</option>';
        selectTheme.disabled = true;
    }

    calculerDuree();
}

async function validerSaisieGroupee(e) {
    e.preventDefault();

    if (!classeurXLSX) {
        alert("Ouvrez d'abord FMPA-RH.xlsx.");
        return;
    }

    const duree = calculerDuree();
    const dateFormation = document.getElementById("saisie-date")?.value;
    const heureDebut = document.getElementById("saisie-heure-debut")?.value;
    const heureFin = document.getElementById("saisie-heure-fin")?.value;
    const idFormation = document.getElementById("saisie-theme")?.value;
    const formateur = document.getElementById("saisie-formateur")?.value.trim() || "";
    const commentaires = document.getElementById("saisie-commentaires")?.value.trim() || "";

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

    const conflits = [];

    agentsSelectionnes.forEach(idAgent => {
        const agent = tableauAgentsRH.find(a => a.id === idAgent);
        if (!agent) return;

        const conflit = verifierChevauchementHoraire(agent.matricule, dateFormation, heureDebut, heureFin);
        if (conflit) {
            conflits.push(`Agent : ${agent.nom} ${agent.prenom} (déjà inscrit à "${conflit.formation}" de ${conflit.heureDebut} à ${conflit.heureFin})`);
        }
    });

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
    element.style.color = erreur ? "#991b1b" : "#1d95d8";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJs(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function annulerSaisie() {
    reinitialiserFormulaire();
    agentsSelectionnes.clear();
    const selectAll = document.getElementById("select-all");
    if (selectAll) selectAll.checked = false;
    filtrerEtAfficherTableau();
}

// --- FONCTION UTILITAIRE DE HACHAGE SHA-256 ---
async function hacherTexte(texte) {
    const encoder = new TextEncoder();
    const data = encoder.encode(texte);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- RÉCUPÉRATION DU HASH DEPUIS EXCEL ---
function obtenirHashAdminDepuisExcel() {
    try {
        if (typeof classeurXLSX !== "undefined" && classeurXLSX?.Sheets?.["Parametres"]) {
            const sheetParam = classeurXLSX.Sheets["Parametres"];
            
            if (sheetParam["B2"] && sheetParam["B2"].v !== undefined && String(sheetParam["B2"].v).trim() !== "") {
                return String(sheetParam["B2"].v).trim();
            }
            
            const data = XLSX.utils.sheet_to_json(sheetParam, { header: 1 });
            if (data && data[1] && data[1][1] !== undefined && String(data[1][1]).trim() !== "") {
                return String(data[1][1]).trim();
            }
        }
    } catch (e) {
        console.error("Erreur lors de la lecture du Hash Excel :", e);
    }
    
    return HASH_DEFAUT_SECOURS;
}

// --- VÉRIFICATION DU CODE ADMIN ---
async function verifierCodeAdmin() {
    const inputCode = document.getElementById("hist-code-admin");
    const inputWact = document.getElementById("hist-ref-wact");
    const btnChangerCode = document.getElementById("btn-changer-code-admin");
    if (!inputCode) return;

    const saisie = inputCode.value.trim();
    const hashValide = obtenirHashAdminDepuisExcel();
    const saisieHash = await hacherTexte(saisie);

    if (saisieHash === hashValide) {
        estAdminDeverrouille = true;
        inputCode.style.border = "2px solid #16a34a";
        inputCode.style.backgroundColor = "#dcfce7";
        
        if (inputWact) {
            inputWact.disabled = false;
            inputWact.style.backgroundColor = "#ffffff";
            inputWact.style.cursor = "pointer";
        }

        if (btnChangerCode) btnChangerCode.style.display = "inline-block";

    } else {
        estAdminDeverrouille = false;
        inputCode.style.border = "";
        inputCode.style.backgroundColor = "";
        
        if (inputWact) {
            inputWact.disabled = true;
            inputWact.style.backgroundColor = "#e2e8f0";
            inputWact.style.cursor = "not-allowed";
        }

        if (btnChangerCode) btnChangerCode.style.display = "none";
    }

    afficherHistorique();
}

// --- MODIFICATION DU CODE ADMIN DEPUIS L'INTERFACE ---
async function modifierMotDePasseAdmin() {
    if (!estAdminDeverrouille) {
        alert("Veuillez d'abord déverrouiller l'accès administrateur.");
        return;
    }

    const nouveauCode = prompt("Saisissez le NOUVEAU mot de passe administrateur :");
    if (!nouveauCode || !nouveauCode.trim()) {
        alert("Changement annulé (mot de passe vide).");
        return;
    }

    const confirmation = prompt("Confirmez le nouveau mot de passe :");
    if (nouveauCode.trim() !== confirmation?.trim()) {
        alert("Les deux mots de passe ne correspondent pas !");
        return;
    }

    const nouveauHash = await hacherTexte(nouveauCode.trim());

    if (typeof classeurXLSX !== "undefined" && classeurXLSX.Sheets) {
        const dateRefExistante = document.getElementById("hist-ref-wact")?.value || "";

        if (!classeurXLSX.Sheets["Parametres"]) {
            const newSheet = XLSX.utils.aoa_to_sheet([
                ["DateRefWact", dateRefExistante],
                ["CodeAdminHash", nouveauHash]
            ]);
            XLSX.utils.book_append_sheet(classeurXLSX, newSheet, "Parametres");
        } else {
            XLSX.utils.sheet_add_aoa(
                classeurXLSX.Sheets["Parametres"], 
                [["CodeAdminHash", nouveauHash]], 
                { origin: "A2" }
            );
        }

        if (typeof fichierHandleXLSX !== "undefined" && fichierHandleXLSX) {
            await enregistrerFichierXLSX();
            alert("🔑 Nouveau mot de passe enregistré avec succès dans le fichier Excel !");
            verifierCodeAdmin();
        } else {
            alert("⚠️ Nouveau mot de passe pris en compte pour la session, mais le fichier Excel n'a pas pu être sauvegardé sur le disque.");
        }
    }
}

async function enregistrerChangementDateWact(e) {
    const nouvelleDate = e.target.value;
    afficherHistorique();

    if (typeof classeurXLSX !== "undefined" && classeurXLSX.Sheets) {
        if (!classeurXLSX.Sheets["Parametres"]) {
            const hashActuel = obtenirHashAdminDepuisExcel();
            const newSheet = XLSX.utils.aoa_to_sheet([
                ["DateRefWact", nouvelleDate],
                ["CodeAdminHash", hashActuel]
            ]);
            XLSX.utils.book_append_sheet(classeurXLSX, newSheet, "Parametres");
        } else {
            XLSX.utils.sheet_add_aoa(
                classeurXLSX.Sheets["Parametres"], 
                [["DateRefWact", nouvelleDate]], 
                { origin: "A1" }
            );
        }

        if (typeof fichierHandleXLSX !== "undefined" && fichierHandleXLSX) {
            await enregistrerFichierXLSX();
        }
    }
}

function ouvrirModalHistorique() {
    indexEnEdition = null;
    
    const inputCode = document.getElementById("hist-code-admin");
    const inputWact = document.getElementById("hist-ref-wact");
    const btnChangerCode = document.getElementById("btn-changer-code-admin");

    if (inputCode) {
        inputCode.value = "";
        inputCode.style.border = "";
        inputCode.style.backgroundColor = "";
    }

    if (inputWact) {
        inputWact.disabled = true;
        inputWact.style.backgroundColor = "#e2e8f0";
        inputWact.style.cursor = "not-allowed";
    }

    if (btnChangerCode) btnChangerCode.style.display = "none";

    estAdminDeverrouille = false;
    
    const modal = document.getElementById("modal-historique");
    if (modal) modal.style.display = "flex";
    
    afficherHistorique();
}

async function fermerModalHistorique() {
    indexEnEdition = null;
    
    const modal = document.getElementById("modal-historique");
    if (modal) modal.style.display = "none";

    const dateRefWact = document.getElementById("hist-ref-wact")?.value || "";

    if (typeof classeurXLSX !== "undefined" && classeurXLSX.Sheets) {
        if (!classeurXLSX.Sheets["Parametres"]) {
            const hashActuel = obtenirHashAdminDepuisExcel();
            const newSheet = XLSX.utils.aoa_to_sheet([
                ["DateRefWact", dateRefWact],
                ["CodeAdminHash", hashActuel]
            ]);
            XLSX.utils.book_append_sheet(classeurXLSX, newSheet, "Parametres");
        } else {
            XLSX.utils.sheet_add_aoa(
                classeurXLSX.Sheets["Parametres"], 
                [["DateRefWact", dateRefWact]], 
                { origin: "A1" }
            );
        }

        if (typeof fichierHandleXLSX !== "undefined" && fichierHandleXLSX) {
            await enregistrerFichierXLSX();
        }
    }
}

function afficherHistorique() {
    const tbody = document.getElementById("tbody-historique");
    if (!tbody) return;

    const filterNom = document.getElementById("hist-search-agent")?.value.toLowerCase().trim() || "";
    const filterDate = document.getElementById("hist-search-date")?.value || "";
    const dateRefWact = document.getElementById("hist-ref-wact")?.value || "";

    tbody.innerHTML = "";

    if (!Array.isArray(historiqueSaisiesFMPA) || historiqueSaisiesFMPA.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px;">Aucune donnée d'historique disponible.</td></tr>`;
        return;
    }

    historiqueSaisiesFMPA.slice().reverse().forEach((row, indexReversed) => {
        const realIndex = historiqueSaisiesFMPA.length - 1 - indexReversed;
        
        const agent = Array.isArray(tableauAgentsRH) ? tableauAgentsRH.find(a => String(a.matricule) === String(row.matricule)) : null;
        const nomAgentComplet = agent ? `${agent.nom} ${agent.prenom}` : `Matricule : ${row.matricule || "-"}`;
        const equipeAgent = agent ? agent.equipe : "-";

        if (filterNom && !nomAgentComplet.toLowerCase().includes(filterNom)) return;
        if (filterDate && row.date !== filterDate) return;

        const estFormateur = row.commentaires?.includes("(Animation / Formateur)") || 
            (row.formateur && nomAgentComplet.toLowerCase().includes(row.formateur.toLowerCase()));

        const formationObj = Array.isArray(catalogueInitial) ? catalogueInitial.find(f => f.libelle === row.formation || f.id === row.formation) : null;
        const activite = formationObj ? formationObj.activite : "-";
        const dateSaisieSeule = (row.dateSaisie || "").split(" ")[0] || "-";

        const estClotureLigne = Boolean(row.cloture || row.dateCloture || row.statut === "clôturé");
        const estClotureWact = Boolean(dateRefWact && dateSaisieSeule !== "-" && dateSaisieSeule <= dateRefWact);
        const estCloture = estClotureLigne || estClotureWact;

        const tr = document.createElement("tr");
        if (estCloture) tr.classList.add("tr-cloture");

        let nomHtml = estFormateur 
            ? `<span class="nom-agent-formateur">🎓 <strong>${escapeHtml(nomAgentComplet)}</strong></span> <span class="badge-formateur">Formateur</span>`
            : `<strong>${escapeHtml(nomAgentComplet)}</strong>`;

        const duree = typeof calculerDureeEntreHeures === "function" ? calculerDureeEntreHeures(row.heureDebut, row.heureFin) : "0";

        if (indexEnEdition === realIndex && estAdminDeverrouille && !estCloture) {
            tr.classList.add("tr-editing");

            let optionsFormations = (catalogueInitial || []).map(f => {
                const isSelected = (f.libelle === row.formation || f.id === row.formation) ? "selected" : "";
                return `<option value="${escapeHtml(f.libelle)}" ${isSelected}>${escapeHtml(f.libelle)}</option>`;
            }).join("");

            tr.innerHTML = `
                <td>${nomHtml}</td>
                <td>${escapeHtml(equipeAgent)}</td>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(dateSaisieSeule)}</td>
                <td id="edit-activite-${realIndex}"><strong>${escapeHtml(activite)}</strong></td>
                <td>
                    <select id="edit-formation-${realIndex}" class="input-inline" onchange="majActiviteEdition(${realIndex})">
                        ${optionsFormations}
                    </select>
                </td>
                <td><input type="time" id="edit-hdebut-${realIndex}" class="input-inline" value="${row.heureDebut || ''}" oninput="calculerDureeEdition(${realIndex})"></td>
                <td><input type="time" id="edit-hfin-${realIndex}" class="input-inline" value="${row.heureFin || ''}" oninput="calculerDureeEdition(${realIndex})"></td>
                <td><strong id="edit-duree-${realIndex}">${duree} h</strong></td>
                <td>
                    <button type="button" class="btn-act-save" onclick="sauvegarderLigneHistorique(${realIndex})">💾 Enregistrer</button>
                    <button type="button" class="btn-act-cancel" onclick="annulerEditionHistorique()">✖ Fermer</button>
                </td>
            `;
        } else {
            let colActions = "";
            if (estCloture) {
                colActions = `<span class="badge-cloture">🔒 Clôturé</span>`;
            } else if (!estAdminDeverrouille) {
                colActions = `<span class="badge-verrouille">🔒 Verrouillé</span>`;
            } else {
                colActions = `
                    <button type="button" class="btn-act-mod" onclick="activerEditionHistorique(${realIndex})">✏️ Modifier</button>
                    <button type="button" class="btn-act-del" onclick="supprimerLigneHistorique(${realIndex})">Annuler 🗑️</button>
                `;
            }

            tr.innerHTML = `
                <td>${nomHtml}</td>
                <td>${escapeHtml(equipeAgent)}</td>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(dateSaisieSeule)}</td>
                <td><strong>${escapeHtml(activite)}</strong></td>
                <td>${escapeHtml(row.formation)}</td>
                <td>${escapeHtml(row.heureDebut)}</td>
                <td>${escapeHtml(row.heureFin)}</td>
                <td><strong>${duree} h</strong></td>
                <td>${colActions}</td>
            `;
        }

        tbody.appendChild(tr);
    });
}

function filtrerHistorique() {
    afficherHistorique();
}

function reinitialiserFiltresHistorique() {
    if (document.getElementById("hist-search-agent")) document.getElementById("hist-search-agent").value = "";
    if (document.getElementById("hist-search-date")) document.getElementById("hist-search-date").value = "";
    if (document.getElementById("hist-ref-wact")) document.getElementById("hist-ref-wact").value = "";
    
    const inputCode = document.getElementById("hist-code-admin");
    if (inputCode) {
        inputCode.value = "";
        inputCode.style.border = "";
        inputCode.style.backgroundColor = "";
    }
    
    verifierCodeAdmin();
}

function activerEditionHistorique(index) {
    if (!estAdminDeverrouille) return;
    indexEnEdition = index;
    afficherHistorique();
}

function annulerEditionHistorique() {
    indexEnEdition = null;
    afficherHistorique();
}

function majActiviteEdition(index) {
    const valForm = document.getElementById(`edit-formation-${index}`)?.value;
    const fObj = (catalogueInitial || []).find(f => f.libelle === valForm || f.id === valForm);
    const cellAct = document.getElementById(`edit-activite-${index}`);
    if (cellAct) {
        cellAct.innerHTML = `<strong>${escapeHtml(fObj ? fObj.activite : "-")}</strong>`;
    }
}

function calculerDureeEdition(index) {
    const hD = document.getElementById(`edit-hdebut-${index}`)?.value;
    const hF = document.getElementById(`edit-hfin-${index}`)?.value;
    const dureeEl = document.getElementById(`edit-duree-${index}`);
    if (dureeEl && hD && hF && typeof calculerDureeEntreHeures === "function") {
        dureeEl.textContent = `${calculerDureeEntreHeures(hD, hF)} h`;
    }
}

async function sauvegarderLigneHistorique(index) {
    const nFormation = document.getElementById(`edit-formation-${index}`)?.value;
    const nDebut = document.getElementById(`edit-hdebut-${index}`)?.value;
    const nFin = document.getElementById(`edit-hfin-${index}`)?.value;

    if (!nFormation || !nDebut || !nFin) {
        alert("Veuillez renseigner tous les champs.");
        return;
    }

    const item = historiqueSaisiesFMPA[index];
    item.formation = nFormation;
    item.heureDebut = nDebut;
    item.heureFin = nFin;
    item.dateSaisie = typeof obtenirDateSaisie === "function" ? obtenirDateSaisie() : item.dateSaisie;

    indexEnEdition = null;

    if (typeof reconstruireCumulsDepuisHistorique === "function") reconstruireCumulsDepuisHistorique();
    if (typeof filtrerEtAfficherTableau === "function") filtrerEtAfficherTableau();
    afficherHistorique();

    if (typeof fichierHandleXLSX !== "undefined" && fichierHandleXLSX) {
        await enregistrerFichierXLSX();
    }
}

async function supprimerLigneHistorique(index) {
    if (!estAdminDeverrouille) return;
    if (!confirm("Voulez-vous vraiment annuler cette saisie ?")) return;

    historiqueSaisiesFMPA.splice(index, 1);
    indexEnEdition = null;

    if (typeof reconstruireCumulsDepuisHistorique === "function") reconstruireCumulsDepuisHistorique();
    if (typeof filtrerEtAfficherTableau === "function") filtrerEtAfficherTableau();
    afficherHistorique();

    if (typeof fichierHandleXLSX !== "undefined" && fichierHandleXLSX) {
        await enregistrerFichierXLSX();
    }
}

function exporterHistoriquePDF() {
    if (!historiqueSaisiesFMPA.length) {
        alert("Aucune donnée à exporter.");
        return;
    }

    const dateRefWact = document.getElementById("hist-ref-wact")?.value || "";
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFontSize(16);
    doc.text("Historique des Saisies FMPA-RH", 14, 15);

    const colonnes = [
        "Agent", "Équipe", "Date Formation", "Date Saisie", 
        "Activité", "Thème / Module", "Début", "Fin", "Durée", "Statut"
    ];

    const lignes = historiqueSaisiesFMPA.slice().reverse().map(row => {
        const agent = Array.isArray(tableauAgentsRH) ? tableauAgentsRH.find(a => a.matricule === row.matricule) : null;
        const nomAgentComplet = agent ? `${agent.nom} ${agent.prenom}` : `Matricule : ${row.matricule}`;
        const equipeAgent = agent ? agent.equipe : "-";

        const estFormateur = row.commentaires?.includes("(Animation / Formateur)") || 
            (row.formateur && nomAgentComplet.toLowerCase().includes(row.formateur.toLowerCase()));

        const nomAffichage = estFormateur ? `${nomAgentComplet} [Formateur]` : nomAgentComplet;

        const formationObj = Array.isArray(catalogueInitial) ? catalogueInitial.find(f => f.libelle === row.formation || f.id === row.formation) : null;
        const activite = formationObj ? formationObj.activite : "-";
        const dateSaisieSeule = (row.dateSaisie || "").split(" ")[0] || "-";
        const duree = typeof calculerDureeEntreHeures === "function" ? calculerDureeEntreHeures(row.heureDebut, row.heureFin) : "0";

        const estClotureLigne = row.cloture || row.dateCloture || row.statut === "clôturé";
        const estClotureWact = dateRefWact && dateSaisieSeule !== "-" && dateSaisieSeule <= dateRefWact;
        const estCloture = estClotureLigne || estClotureWact;

        const statutTexte = estCloture ? "Clôturé W@ct" : "A traiter";

        return [
            nomAffichage,
            equipeAgent,
            row.date,
            dateSaisieSeule,
            activite,
            row.formation,
            row.heureDebut,
            row.heureFin,
            `${duree} h`,
            statutTexte
        ];
    });

    doc.autoTable({
        startY: 22,
        head: [colonnes],
        body: lignes,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 9) {
                if (data.cell.raw === "Clôturé W@ct") {
                    data.cell.styles.textColor = [185, 28, 28];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    doc.save(`Historique_FMPA_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ==========================================
// GESTION DU BILAN & FICHE ÉQUIPE
// ==========================================

function ouvrirModalEquipe() {
    const modal = document.getElementById('modal-equipe');
    if (!modal) return;

    modal.style.display = 'flex';
    alimenterSelectEquipeModal();

    const filtrePrincipal = document.getElementById('filter-equipe');
    const selectModal = document.getElementById('modal-select-equipe');
    if (filtrePrincipal && filtrePrincipal.value && selectModal) {
        selectModal.value = filtrePrincipal.value;
    }

    genererFicheEquipe();
}

function fermerModalEquipe() {
    const modal = document.getElementById('modal-equipe');
    if (modal) modal.style.display = 'none';
}

function alimenterSelectEquipeModal() {
    const select = document.getElementById('modal-select-equipe');
    if (!select) return;

    const equipes = [...new Set(tableauAgentsRH.map(a => a.Equipe || a.equipe).filter(Boolean))].sort();
    
    const valeurActuelle = select.value;
    select.innerHTML = '<option value="">-- Choisir une équipe --</option>';
    
    equipes.forEach(eq => {
        const opt = document.createElement('option');
        opt.value = eq;
        opt.textContent = eq;
        select.appendChild(opt);
    });

    if (valeurActuelle) select.value = valeurActuelle;
}

/**
 * Filtre une liste d'agents en fonction d'un module/domaine de formation requis.
 * @param {Array} listeAgents - La liste complète des agents
 * @param {string} filtreModule - Le nom ou l'ID du module/domaine à filtrer
 * @returns {Array} La liste des agents filtrés
 */
function filtrerAgentsPourModale(listeAgents, filtreModule) {
    if (!Array.isArray(listeAgents)) return [];
    if (!filtreModule || filtreModule.trim() === "") return listeAgents;

    const recherche = filtreModule.toLowerCase().trim();

    return listeAgents.filter(agent => {
        const specialites = Array.isArray(agent.specialites) ? agent.specialites.join(" ") : String(agent.specialites || agent.Specialites || "");
        const competences = Array.isArray(agent.competences) ? agent.competences.join(" ") : String(agent.competences || agent.Competences || "");
        const nomComplet = `${agent.nom || agent.Nom || ''} ${agent.prenom || agent.Prenom || ''}`;
        const infosAgent = `${agent.equipe || agent.Equipe || ""} ${specialites} ${competences} ${nomComplet}`.toLowerCase();

        return infosAgent.includes(recherche);
    });
}

function genererFicheEquipe() {
    const selectEquipe = document.getElementById('modal-select-equipe');
    const conteneurModules = document.getElementById('conteneur-modules-equipe');
    const nomEquipe = selectEquipe ? selectEquipe.value : '';

    const dateEd = document.getElementById('fiche-date-edition');
    if (dateEd) dateEd.textContent = new Date().toLocaleDateString('fr-FR');

    if (!nomEquipe) {
        const tit = document.getElementById('fiche-titre-equipe');
        const eff = document.getElementById('fiche-effectif');
        if (tit) tit.textContent = "BILAN FMA - Aucune équipe sélectionnée";
        if (eff) eff.textContent = "0 agent(s)";
        if (conteneurModules) conteneurModules.innerHTML = `<div style="text-align:center; padding: 20px; color: #64748b;">Veuillez sélectionner une équipe dans la liste ci-dessus.</div>`;
        mettreAJourJauge('barre-global', 'txt-pct-global', 'txt-heures-global', 0, 0);
        mettreAJourJauge('barre-socle', 'txt-pct-socle', null, 0, 0);
        mettreAJourJauge('barre-spe', 'txt-pct-spe', null, 0, 0);
        return;
    }

    // 1. Agents de l'équipe
    let agentsEquipe = (tableauAgentsRH || []).filter(a => {
        const eq = a.Equipe || a.equipe || a.EQUIPE || a['Équipe'];
        return eq === nomEquipe;
    });

    // 2. Application du filtre de recherche si saisi
    const inputFiltre = document.getElementById('filter-module') || document.getElementById('filter-recherche');
    const termeFiltre = inputFiltre ? inputFiltre.value : '';
    agentsEquipe = filtrerAgentsPourModale(agentsEquipe, termeFiltre);

    const effectifTotal = agentsEquipe.length;

    const tit = document.getElementById('fiche-titre-equipe');
    const eff = document.getElementById('fiche-effectif');
    if (tit) tit.textContent = `BILAN FMA - Équipe ${nomEquipe}`;
    if (eff) eff.textContent = `${effectifTotal} agent(s)`;

    if (effectifTotal === 0) {
        if (conteneurModules) conteneurModules.innerHTML = `<div style="text-align:center; padding: 20px; color: #64748b;">Aucun agent trouvé pour l'équipe ${nomEquipe}.</div>`;
        return;
    }

    const catalogue = catalogueInitial || [];
    if (catalogue.length === 0) {
        if (conteneurModules) conteneurModules.innerHTML = `<div style="text-align:center; padding: 20px; color: #64748b;">Catalogue vide. Chargez d'abord FMPA-RH.xlsx.</div>`;
        return;
    }

    const epurer = (str) => String(str || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');

    const calculerDureesSaisie = (saisie) => {
        if (saisie.duree || saisie.Duree || saisie.heures || saisie.Heures) {
            return parseFloat(saisie.duree || saisie.Duree || saisie.heures || saisie.Heures || 0);
        }
        if (saisie.heureDebut && saisie.heureFin) {
            const [hD, mD] = saisie.heureDebut.split(':').map(Number);
            const [hF, mF] = saisie.heureFin.split(':').map(Number);
            const debutMin = hD * 60 + (mD || 0);
            const finMin = hF * 60 + (mF || 0);
            if (finMin > debutMin) return (finMin - debutMin) / 60;
        }
        return 0;
    };

    // Helper pour savoir si un agent a une spécialité donnée
    const agentAParticuliereSpe = (agent, nomSpe) => {
        const speList = Array.isArray(agent.specialites) 
            ? agent.specialites.join(' ') 
            : String(agent.specialites || agent.Specialites || agent.spe || agent.Spe || '');
        return epurer(speList).includes(epurer(nomSpe));
    };

    const activitesMap = {};

    catalogue.forEach(item => {
        const nomActivite = item.activite || item.Activite || item.Domaine || item.domaine || "Général";
        const nomFormation = item.libelle || item.Libelle || item.fmpa || item.sequence || "Formation";
        const heuresCibleAgent = parseFloat(item.quota || item.Quota || item.heures || item.Heures || 0);

        if (!activitesMap[nomActivite]) {
            activitesMap[nomActivite] = {
                nom: nomActivite,
                formations: [],
                type: String(item.type || item.Type || '').toLowerCase()
            };
        }

        activitesMap[nomActivite].formations.push({
            nom: nomFormation,
            id: item.id || '',
            heuresCibleAgent: heuresCibleAgent
        });
    });

    let totalHeuresFaitesGlobal = 0;
    let totalHeuresCibleGlobal = 0;
    let totalSocleFait = 0, totalSocleCible = 0;
    let totalSpeFait = 0, totalSpeCible = 0;

    let htmlContenu = '';

    Object.values(activitesMap).forEach(act => {
        let activiteHeuresFaites = 0;
        let activiteHeuresCible = 0;
        let htmlFormations = '';

        const estSpe = act.type.includes('spe') || act.type.includes('spé');

        act.formations.forEach(f => {
            // S'il s'agit d'une spécialité, on ne cible QUE les agents ayant cette spécialité
            // Sinon (Socle commun), on cible TOUS les agents de l'équipe
            const agentsConcernes = estSpe 
                ? agentsEquipe.filter(a => agentAParticuliereSpe(a, act.nom) || agentAParticuliereSpe(a, f.nom))
                : agentsEquipe;

            const effectifConcerne = agentsConcernes.length;

            // Si c'est une spécialité et qu'aucun agent n'est spécialisé dedans, on passe la formation
            if (estSpe && effectifConcerne === 0) {
                return;
            }

            const cibleTotaleModule = f.heuresCibleAgent * effectifConcerne;
            activiteHeuresCible += cibleTotaleModule;

            let formationHeuresFaites = 0;
            let agentsAFormer = [];

            const keyFormationCatalogue = epurer(f.nom);

            agentsConcernes.forEach(agent => {
                const mat = String(agent.matricule || agent.Matricule || agent.id || '');
                const nomPrenom = `${agent.nom || agent.Nom || ''} ${agent.prenom || agent.Prenom || ''}`.trim() || `Agent ${mat}`;

                let hAgent = 0;

                if (Array.isArray(historiqueSaisiesFMPA)) {
                    hAgent = historiqueSaisiesFMPA
                        .filter(s => {
                            const sMat = String(s.matricule || s.Matricule || '');
                            const sForm = epurer(s.formation || s.Formation || s.libelle || s.fmpa || '');
                            return (sMat === mat) && (sForm === keyFormationCatalogue || sForm.includes(keyFormationCatalogue) || keyFormationCatalogue.includes(sForm));
                        })
                        .reduce((sum, s) => sum + calculerDureesSaisie(s), 0);
                }

                formationHeuresFaites += hAgent;

                if (hAgent < f.heuresCibleAgent) {
                    agentsAFormer.push({
                        nom: nomPrenom,
                        fait: hAgent,
                        reste: f.heuresCibleAgent - hAgent,
                        objectif: f.heuresCibleAgent
                    });
                }
            });

            activiteHeuresFaites += formationHeuresFaites;
            agentsAFormer.sort((a, b) => b.reste - a.reste);

            const pctFormation = cibleTotaleModule > 0 ? Math.min(100, Math.round((formationHeuresFaites / cibleTotaleModule) * 100)) : 100;
            const formationEstAJour = (pctFormation >= 100) || (f.heuresCibleAgent > 0 && agentsAFormer.length === 0);

            // Badge visuel Socle vs Spécialité
            const badgeType = estSpe 
                ? `<span style="background: #e0e7ff; color: #4338ca; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 600;">Spécialité (${effectifConcerne} agent(s))</span>`
                : `<span style="background: #f1f5f9; color: #475569; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Socle Commun</span>`;

            htmlFormations += `
                <div style="background: ${formationEstAJour ? '#f0fdf4' : '#ffffff'}; border: 1px solid ${formationEstAJour ? '#bbf7d0' : '#cbd5e1'}; border-radius: 6px; padding: 10px 14px; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div>
                            <strong style="color: #1e293b; font-size: 0.95rem;">${f.nom}</strong>
                            ${badgeType}
                            <span style="font-size: 0.8rem; color: #64748b; margin-left: 6px;">(Objectif : ${f.heuresCibleAgent}h/agent)</span>
                        </div>
                        <div style="font-weight: bold; color: ${formationEstAJour ? '#16a34a' : '#d97706'}; font-size: 0.95rem;">
                            ${pctFormation}% <span style="font-size: 0.8rem; color: #64748b; font-weight: normal;">(${formationHeuresFaites}h / ${cibleTotaleModule}h)</span>
                        </div>
                    </div>

                    <div style="width: 100%; background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                        <div style="width: ${pctFormation}%; background: ${formationEstAJour ? '#16a34a' : '#d97706'}; height: 100%;"></div>
                    </div>

                    ${formationEstAJour ? `
                        <div style="color: #16a34a; font-weight: bold; font-size: 0.82rem;">✅ Module 100% à jour</div>
                    ` : `
                        <div style="font-size: 0.82rem; color: #334155;">
                            <strong>Restent à former (${agentsAFormer.length} agent(s)) :</strong> 
                            ${agentsAFormer.map(a => `${a.nom} <span style="color: #dc2626; font-weight: bold;">(${a.fait}/${a.objectif}h)</span>`).join(', ')}
                        </div>
                    `}
                </div>
            `;
        });

        // Si le domaine est une spécialité mais qu'aucune formation n'a été affichée (aucun agent spécialisé)
        if (htmlFormations === '') return;

        totalHeuresFaitesGlobal += activiteHeuresFaites;
        totalHeuresCibleGlobal += activiteHeuresCible;

        if (estSpe) {
            totalSpeFait += activiteHeuresFaites;
            totalSpeCible += activiteHeuresCible;
        } else {
            totalSocleFait += activiteHeuresFaites;
            totalSocleCible += activiteHeuresCible;
        }

        const pctActivite = activiteHeuresCible > 0 ? Math.min(100, Math.round((activiteHeuresFaites / activiteHeuresCible) * 100)) : 0;

        htmlContenu += `
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <h3 style="margin: 0; color: #0f172a; font-size: 1.1rem;">📂 Domaine / Activité : ${act.nom}</h3>
                    <span style="font-size: 1.1rem; font-weight: bold; color: ${pctActivite >= 100 ? '#16a34a' : '#0284c7'};">${pctActivite}% (${activiteHeuresFaites}h / ${activiteHeuresCible}h)</span>
                </div>
                
                <div style="width: 100%; background: #cbd5e1; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 12px;">
                    <div style="width: ${pctActivite}%; background: ${pctActivite >= 100 ? '#16a34a' : '#0284c7'}; height: 100%;"></div>
                </div>

                <div style="padding-left: 8px;">
                    ${htmlFormations}
                </div>
            </div>
        `;
    });

    mettreAJourJauge('barre-global', 'txt-pct-global', 'txt-heures-global', totalHeuresFaitesGlobal, totalHeuresCibleGlobal);
    mettreAJourJauge('barre-socle', 'txt-pct-socle', null, totalSocleFait, totalSocleCible);
    mettreAJourJauge('barre-spe', 'txt-pct-spe', null, totalSpeFait, totalSpeCible);

    if (conteneurModules) conteneurModules.innerHTML = htmlContenu;
}

function mettreAJourJauge(idBarre, idTxtPct, idTxtHeures, fait, total) {
    const pct = total > 0 ? Math.min(100, Math.round((fait / total) * 100)) : 0;
    
    const barre = document.getElementById(idBarre);
    const txtPct = document.getElementById(idTxtPct);
    const txtHeures = document.getElementById(idTxtHeures);

    if (barre) barre.style.width = `${pct}%`;
    if (txtPct) txtPct.textContent = `${pct}%`;
    if (txtHeures) txtHeures.textContent = `${fait}h / ${total}h`;
}

window.addEventListener('click', function(event) {
    const modalHist = document.getElementById('modal-historique');
    const modalEq = document.getElementById('modal-equipe');
    if (event.target === modalHist) fermerModalHistorique();
    if (event.target === modalEq) fermerModalEquipe();
});
