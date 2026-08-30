/*
 * FMPA-RH - Saisie des formations
 * Migration CSV -> FMPA-RH.xlsx
 *
 * Source de données :
 *   - baseAgents
 *   - catalogue
 *   - historiqueSuivi
 *
 * Aucun localStorage.
 */

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

    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    afficherMessageAccueil();

    document.getElementById("btn-open-xlsx")
        ?.addEventListener("click", ouvrirFichierXLSX);

    document.getElementById("file-input-xlsx")
        ?.addEventListener("change", importerXLSXFallback);

    document.getElementById("btn-save-xlsx")
        ?.addEventListener("click", enregistrerFichierXLSX);

    document.getElementById("filter-equipe")
        ?.addEventListener("change", filtrerEtAfficherTableau);

    document.getElementById("filter-statut")
        ?.addEventListener("change", filtrerEtAfficherTableau);

    document.getElementById("filter-search")
        ?.addEventListener("input", filtrerEtAfficherTableau);

    document.getElementById("btn-reset-filters")
        ?.addEventListener("click", reinitialiserFiltres);

    document.getElementById("saisie-heure-debut")
        ?.addEventListener("change", calculerDuree);

    document.getElementById("saisie-heure-fin")
        ?.addEventListener("change", calculerDuree);

    document.getElementById("saisie-activite")
        ?.addEventListener("change", majListeThemes);

    document.getElementById("select-all")
        ?.addEventListener("change", basculerToutSelectionner);

    document.getElementById("form-saisie-groupee")
        ?.addEventListener("submit", validerSaisieGroupee);

    calculerDuree();
});


/* ============================================================
   ACCUEIL
   ============================================================ */

function afficherMessageAccueil() {

    const tbody = document.getElementById("tbody-agents");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6"
                style="text-align:center; padding:40px; color:#64748b;">

                <div style="font-size:1.1rem; margin-bottom:8px;">
                    <strong>Aucun fichier Excel chargé</strong>
                </div>

                Cliquez sur
                <strong>📂 Ouvrir FMPA-RH.xlsx</strong>.

            </td>
        </tr>
    `;
}


/* ============================================================
   OUVERTURE DU FICHIER EXCEL
   ============================================================ */

async function ouvrirFichierXLSX() {

    try {

        if (!window.XLSX) {

            alert(
                "La bibliothèque SheetJS n'est pas disponible.\n" +
                "Vérifiez votre connexion réseau."
            );

            return;
        }


        /*
         * Edge / Chrome :
         * File System Access API
         */

        if ("showOpenFilePicker" in window) {

            const [handle] = await window.showOpenFilePicker({

                multiple: false,

                types: [
                    {
                        description: "Classeur Excel FMPA-RH",

                        accept: {
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                                [".xlsx"],

                            "application/vnd.ms-excel":
                                [".xls"]
                        }
                    }
                ]
            });


            fichierHandleXLSX = handle;

            const file = await handle.getFile();

            nomFichierXLSX = file.name;

            await chargerClasseur(file);

        }

        /*
         * Navigateur ne supportant pas
         * File System Access API
         */

        else {

            document
                .getElementById("file-input-xlsx")
                ?.click();
        }

    }

    catch (err) {

        if (err?.name !== "AbortError") {

            console.error(err);

            afficherStatut(
                `🔴 Erreur d'ouverture : ${err.message}`,
                true
            );
        }
    }
}


/* ============================================================
   IMPORT DE SECOURS
   ============================================================ */

async function importerXLSXFallback(e) {

    const file = e.target.files?.[0];

    if (!file) return;

    fichierHandleXLSX = null;

    nomFichierXLSX = file.name;

    try {

        await chargerClasseur(file);

    }

    catch (err) {

        console.error(err);

        afficherStatut(
            `🔴 Erreur de lecture : ${err.message}`,
            true
        );
    }

    finally {

        e.target.value = "";
    }
}


/* ============================================================
   LECTURE DU CLASSEUR
   ============================================================ */

async function chargerClasseur(file) {

    const buffer = await file.arrayBuffer();

    classeurXLSX = XLSX.read(buffer, {
        type: "array",
        cellDates: true
    });


    verifierOngletsObligatoires(classeurXLSX);


    tableauAgentsRH =
        convertirBaseAgents(
            classeurXLSX.Sheets.baseAgents
        );


    catalogueInitial =
        convertirCatalogue(
            classeurXLSX.Sheets.catalogue
        );


    historiqueSaisiesFMPA =
        convertirHistorique(
            classeurXLSX.Sheets.historiqueSuivi
        );


    reconstruireCumulsDepuisHistorique();


    agentsSelectionnes.clear();


    alimenterSelectFiltres();

    initialiserFiltresEtListes();

    filtrerEtAfficherTableau();


    document.getElementById("btn-save-xlsx").disabled =
        !fichierHandleXLSX;


    afficherStatut(
        `🟢 ${nomFichierXLSX} chargé — ` +
        `${tableauAgentsRH.length} agent(s), ` +
        `${catalogueInitial.length} formation(s), ` +
        `${historiqueSaisiesFMPA.length} ligne(s) d'historique.`
    );
}


/* ============================================================
   VÉRIFICATION DES ONGLETS
   ============================================================ */

function verifierOngletsObligatoires(wb) {

    const requis = [
        "baseAgents",
        "catalogue",
        "historiqueSuivi"
    ];

    const manquants =
        requis.filter(
            nom => !wb.Sheets[nom]
        );


    if (manquants.length) {

        throw new Error(
            `Onglet(s) manquant(s) : ${manquants.join(", ")}`
        );
    }
}


/* ============================================================
   CONVERSION D'UNE FEUILLE EN OBJETS
   ============================================================ */

function feuilleVersObjets(ws) {

    if (!ws) return [];

    return XLSX.utils.sheet_to_json(ws, {

        defval: "",

        raw: true
    });
}


/* ============================================================
   BASE AGENTS
   ============================================================ */

function convertirBaseAgents(ws) {

    const lignes = feuilleVersObjets(ws);


    return lignes

        .filter(
            ligne =>
                String(
                    ligne.Matricule ?? ""
                ).trim() !== ""
        )

        .filter(
            ligne =>
                String(
                    ligne.Statut ?? ""
                ).trim().toUpperCase() !== "PATS"
        )

        .map((ligne, index) => {

            const matricule =
                String(ligne.Matricule).trim();


            return {

                id:
                    matricule ||
                    `AG-${index + 1}`,

                matricule,

                sexe:
                    valeurTexte(ligne.Sexe),

                nom:
                    valeurTexte(ligne.Nom)
                        .toUpperCase(),

                prenom:
                    valeurTexte(ligne.Prenom),

                equipe:
                    valeurTexte(ligne.Equipe) ||
                    "Non affecté",

                statut:
                    valeurTexte(ligne.Statut),

                grade:
                    valeurTexte(ligne.Grade),

                fonction:
                    valeurTexte(ligne.Fonction),

                specialites:
                    convertirListe(
                        ligne.Specialites
                    ),

                competences:
                    convertirListe(
                        ligne.Competences
                    ),

                engagement:
                    valeurTexte(
                        ligne.Engagement
                    ),

                regime:
                    valeurTexte(
                        ligne.Regime
                    )
            };
        });
}


/* ============================================================
   CATALOGUE
   ============================================================ */

function convertirCatalogue(ws) {

    const lignes = feuilleVersObjets(ws);


    return lignes

        .filter(
            ligne =>
                String(
                    ligne.id ?? ""
                ).trim() !== ""
        )

        .map(ligne => {

            const modulations =
                parserModulations(
                    ligne.modulations
                );


            return {

                id:
                    valeurTexte(ligne.id),

                type:
                    valeurTexte(ligne.type),

                fmpa:
                    valeurTexte(ligne.fmpa),

                activite:
                    valeurTexte(ligne.activite),

                libelle:
                    valeurTexte(ligne.libelle),

                quota:
                    Number(ligne.quota) || 0,

                sequence:
                    valeurTexte(ligne.sequence),

                modulations,

                profils:
                    extraireProfilsDesModulations(
                        modulations
                    ),

                dispenses:
                    extraireDispensesDesModulations(
                        modulations
                    )
            };
        });
}


/* ============================================================
   MODULATIONS
   ============================================================ */

function parserModulations(valeur) {

    if (Array.isArray(valeur)) {
        return valeur;
    }


    const texte =
        valeurTexte(valeur).trim();


    if (!texte) {
        return [];
    }


    try {

        const parsed =
            JSON.parse(texte);

        return Array.isArray(parsed)
            ? parsed
            : [];

    }

    catch (_) {

        return [];
    }
}


function extraireProfilsDesModulations(modulations) {

    return modulations

        .filter(
            m => m && m.profil
        )

        .map(
            m =>
                String(m.profil).trim()
        )

        .filter(Boolean);
}


function extraireDispensesDesModulations(modulations) {

    return modulations

        .filter(
            m =>
                m &&
                (
                    m.dispense === true ||
                    m.type === "dispense"
                )
        )

        .map(
            m =>
                String(
                    m.profil ||
                    m.valeur ||
                    ""
                ).trim()
        )

        .filter(Boolean);
}


/* ============================================================
   HISTORIQUE
   ============================================================ */

function convertirHistorique(ws) {

    const lignes =
        feuilleVersObjets(ws);


    return lignes

        .filter(
            ligne =>
                String(
                    ligne.Matricule ?? ""
                ).trim() !== ""
        )

        .map(ligne => ({

            matricule:
                valeurTexte(
                    ligne.Matricule
                ),

            date:
                normaliserDate(
                    ligne.Date
                ),

            heureDebut:
                normaliserHeure(
                    ligne.HeureDebut
                ),

            heureFin:
                normaliserHeure(
                    ligne.HeureFin
                ),

            formation:
                valeurTexte(
                    ligne.Formation
                ),

            formateur:
                valeurTexte(
                    ligne.Formateur
                ),

            commentaires:
                valeurTexte(
                    ligne.Commentaires
                ),

            dateSaisie:
                normaliserDateHeure(
                    ligne.DateSaisie
                )
        }));
}


/* ============================================================
   UTILITAIRES DONNÉES
   ============================================================ */

function valeurTexte(valeur) {

    if (
        valeur === null ||
        valeur === undefined
    ) {
        return "";
    }

    return String(valeur).trim();
}


function convertirListe(valeur) {

    if (Array.isArray(valeur)) {

        return valeur
            .map(v => String(v).trim())
            .filter(Boolean);
    }


    return valeurTexte(valeur)

        .split(/[,/;]/)

        .map(v => v.trim())

        .filter(Boolean);
}


/* ============================================================
   DATES
   ============================================================ */

function normaliserDate(valeur) {

    if (
        valeur instanceof Date &&
        !isNaN(valeur)
    ) {

        return valeur
            .toISOString()
            .slice(0, 10);
    }


    if (typeof valeur === "number") {

        const date =
            XLSX.SSF.parse_date_code(
                valeur
            );


        if (date) {

            return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        }
    }


    const texte =
        valeurTexte(valeur);


    if (!texte) return "";


    const iso =
        texte.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );


    if (iso) {
        return iso[0];
    }


    const fr =
        texte.match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/
        );


    if (fr) {

        return `${fr[3]}-${fr[2]}-${fr[1]}`;
    }


    return texte;
}


/* ============================================================
   HEURES
   ============================================================ */

function normaliserHeure(valeur) {

    if (
        valeur instanceof Date &&
        !isNaN(valeur)
    ) {

        return `${String(valeur.getHours()).padStart(2, "0")}:${String(valeur.getMinutes()).padStart(2, "0")}`;
    }


    if (typeof valeur === "number") {

        const totalMinutes =
            Math.round(
                valeur * 24 * 60
            );


        const h =
            Math.floor(
                totalMinutes / 60
            ) % 24;


        const m =
            totalMinutes % 60;


        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }


    return valeurTexte(valeur);
}


/* ============================================================
   DATE + HEURE DE SAISIE
   ============================================================ */

function normaliserDateHeure(valeur) {

    if (
        valeur instanceof Date &&
        !isNaN(valeur)
    ) {

        const pad =
            n =>
                String(n).padStart(2, "0");


        return `${valeur.getFullYear()}-${pad(valeur.getMonth() + 1)}-${pad(valeur.getDate())} ${pad(valeur.getHours())}:${pad(valeur.getMinutes())}:${pad(valeur.getSeconds())}`;
    }


    return valeurTexte(valeur);
}


/* ============================================================
   FILTRES
   ============================================================ */

function alimenterSelectFiltres() {

    const selectEquipe =
        document.getElementById(
            "filter-equipe"
        );


    if (selectEquipe) {

        selectEquipe.innerHTML =
            '<option value="">Toutes</option>';


        [
            ...new Set(
                tableauAgentsRH
                    .map(a => a.equipe)
                    .filter(Boolean)
            )
        ]

            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "fr"
                    )
            )

            .forEach(eq => {

                const opt =
                    document.createElement(
                        "option"
                    );

                opt.value = eq;
                opt.textContent = eq;

                selectEquipe.appendChild(opt);
            });
    }


    const selectStatut =
        document.getElementById(
            "filter-statut"
        );


    if (selectStatut) {

        selectStatut.innerHTML =
            '<option value="">Tous</option>';


        [
            ...new Set(
                tableauAgentsRH
                    .map(a => a.statut)
                    .filter(Boolean)
            )
        ]

            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "fr"
                    )
            )

            .forEach(st => {

                const opt =
                    document.createElement(
                        "option"
                    );

                opt.value = st;
                opt.textContent = st;

                selectStatut.appendChild(opt);
            });
    }
}


/* ============================================================
   LISTES DU FORMULAIRE
   ============================================================ */

function initialiserFiltresEtListes() {

    const selectAct =
        document.getElementById(
            "saisie-activite"
        );


    if (selectAct) {

        selectAct.innerHTML =
            '<option value="">-- Choisir un domaine --</option>';


        [
            ...new Set(
                catalogueInitial
                    .map(item => item.activite)
                    .filter(Boolean)
            )
        ]

            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "fr"
                    )
            )

            .forEach(act => {

                const opt =
                    document.createElement(
                        "option"
                    );

                opt.value = act;
                opt.textContent = act;

                selectAct.appendChild(opt);
            });


        selectAct.disabled =
            catalogueInitial.length === 0;
    }


    const datalist =
        document.getElementById(
            "liste-formateurs"
        );


    if (datalist) {

        datalist.innerHTML = "";


        tableauAgentsRH.forEach(agent => {

            const opt =
                document.createElement(
                    "option"
                );


            const gradeStr =
                agent.grade
                    ? `${agent.grade} `
                    : "";


            opt.value =
                `${gradeStr}${agent.nom} ${agent.prenom}`.trim();


            datalist.appendChild(opt);
        });
    }
}


/* ============================================================
   THÈMES / FORMATIONS
   ============================================================ */

function majListeThemes() {

    const activite =
        document.getElementById(
            "saisie-activite"
        ).value;


    const selectTheme =
        document.getElementById(
            "saisie-theme"
        );


    selectTheme.innerHTML =
        '<option value="">-- Choisir une formation --</option>';


    if (!activite) {

        selectTheme.disabled = true;

        return;
    }


    const formations =
        catalogueInitial

            .filter(
                f =>
                    f.activite === activite
            )

            .sort(
                (a, b) =>
                    a.libelle.localeCompare(
                        b.libelle,
                        "fr"
                    )
            );


    formations.forEach(f => {

        const opt =
            document.createElement(
                "option"
            );


        opt.value = f.id;

        opt.textContent =
            `${f.libelle} (${f.quota}h)`;


        selectTheme.appendChild(opt);
    });


    selectTheme.disabled =
        formations.length === 0;
}


/* ============================================================
   CALCUL DE DURÉE
   ============================================================ */

function calculerDuree() {

    const debut =
        document.getElementById(
            "saisie-heure-debut"
        ).value;


    const fin =
        document.getElementById(
            "saisie-heure-fin"
        ).value;


    const display =
        document.getElementById(
            "duree-calculee"
        );


    if (!debut || !fin) {

        display.textContent = "0.0 h";

        return 0;
    }


    const [hD, mD] =
        debut.split(":").map(Number);


    const [hF, mF] =
        fin.split(":").map(Number);


    let minutesTotal =
        (hF * 60 + mF) -
        (hD * 60 + mD);


    if (minutesTotal < 0) {

        minutesTotal +=
            24 * 60;
    }


    const heures =
        (minutesTotal / 60)
            .toFixed(1);


    display.textContent =
        `${heures} h`;


    return parseFloat(heures);
}


function calculerDureeEntreHeures(
    debut,
    fin
) {

    if (!debut || !fin) {
        return 0;
    }


    const d =
        String(debut)
            .split(":")
            .map(Number);


    const f =
        String(fin)
            .split(":")
            .map(Number);


    if (
        d.length < 2 ||
        f.length < 2 ||
        d.some(Number.isNaN) ||
        f.some(Number.isNaN)
    ) {
        return 0;
    }


    let minutes =
        (f[0] * 60 + f[1]) -
        (d[0] * 60 + d[1]);


    if (minutes < 0) {

        minutes +=
            24 * 60;
    }


    return minutes / 60;
}


/* ============================================================
   AFFICHAGE DES AGENTS
   ============================================================ */

function filtrerEtAfficherTableau() {

    const equipeFiltre =
        document.getElementById(
            "filter-equipe"
        ).value;


    const statutFiltre =
        document.getElementById(
            "filter-statut"
        )?.value || "";


    const recherche =
        document.getElementById(
            "filter-search"
        ).value
            .toLowerCase()
            .trim();


    const agentsFiltres =
        tableauAgentsRH.filter(agent => {

            const matchEquipe =
                !equipeFiltre ||
                agent.equipe === equipeFiltre;


            const matchStatut =
                !statutFiltre ||
                agent.statut === statutFiltre;


            const terme =
                `${agent.nom} ${agent.prenom} ${agent.matricule} ${agent.grade} ${agent.fonction}`
                    .toLowerCase();


            const matchRecherche =
                !recherche ||
                terme.includes(recherche);


            return (
                matchEquipe &&
                matchStatut &&
                matchRecherche
            );
        });


    agentsFiltres.sort(
        (a, b) =>
            a.nom.localeCompare(
                b.nom,
                "fr",
                {
                    sensitivity: "base"
                }
            )
    );


    afficherTableauAgents(
        agentsFiltres
    );
}


/* ============================================================
   RÉINITIALISER FILTRES
   ============================================================ */

function reinitialiserFiltres() {

    document.getElementById(
        "filter-equipe"
    ).value = "";


    document.getElementById(
        "filter-statut"
    ).value = "";


    document.getElementById(
        "filter-search"
    ).value = "";


    filtrerEtAfficherTableau();
}


/* ============================================================
   TABLEAU AGENTS
   ============================================================ */

function afficherTableauAgents(
    listeAgents
) {

    const tbody =
        document.getElementById(
            "tbody-agents"
        );


    if (!tbody) return;


    tbody.innerHTML = "";


    if (listeAgents.length === 0) {

        tbody.innerHTML =
            '<tr><td colspan="6" class="empty-msg">Aucun agent à afficher.</td></tr>';


        document.getElementById(
            "count-badge"
        ).textContent =
            `0 / ${tableauAgentsRH.length} agent(s)`;


        majStatutSelection();

        return;
    }


    listeAgents.forEach(agent => {

        const idAgent =
            agent.id;


        const isChecked =
            agentsSelectionnes.has(
                idAgent
            )
                ? "checked"
                : "";


        const avancementSocleHtml =
            genererAvancementSocle(
                agent
            );


        const avancementSpecHtml =
            genererAvancementSpecialites(
                agent
            );


        const tr =
            document.createElement(
                "tr"
            );


        if (isChecked) {

            tr.classList.add(
                "selected-row"
            );
        }


        const gradeStr =
            agent.grade
                ? `${agent.grade} `
                : "";


        const fonctionStr =
            agent.fonction
                ? ` (${agent.fonction})`
                : "";


        const agentLibelle =
            `${gradeStr}<strong>${escapeHtml(agent.nom)}</strong> ${escapeHtml(agent.prenom)}${escapeHtml(fonctionStr)}`;


        tr.innerHTML = `

            <td>

                <input
                    type="checkbox"
                    class="chk-agent"
                    value="${escapeHtml(idAgent)}"
                    ${isChecked}
                    onchange="toggleAgent('${escapeJs(idAgent)}')"
                >

            </td>


            <td>
                ${agentLibelle}
            </td>


            <td>
                ${escapeHtml(agent.equipe)}
            </td>


            <td>

                <span class="badge-tag badge-statut">
                    ${escapeHtml(agent.statut || "-")}
                </span>

            </td>


            <td>
                <small>
                    ${avancementSocleHtml}
                </small>
            </td>


            <td>
                <small>
                    ${avancementSpecHtml}
                </small>
            </td>

        `;


        tbody.appendChild(tr);
    });


    document.getElementById(
        "count-badge"
    ).textContent =
        `${listeAgents.length} / ${tableauAgentsRH.length} agent(s)`;


    majStatutSelection();
}


/* ============================================================
   AVANCEMENT SOCLE
   ============================================================ */

function genererAvancementSocle(
    agent
) {

    const idAgent =
        agent.id;


    const heuresAgent =
        cumulHeuresParAgent[idAgent] || {};


    const socleFormations =
        catalogueInitial.filter(
            f =>
                String(f.type)
                    .toUpperCase() ===
                "SOCLE COMMUN"
        );


    if (!socleFormations.length) {

        return `
            <span style="color:#64748b;">
                Catalogue non chargé
            </span>
        `;
    }


    const tousLesProfilsAgent =
        new Set([

            ...extraireValeurs(
                agent.statut
            ),

            ...extraireValeurs(
                agent.grade
            ),

            ...extraireValeurs(
                agent.fonction
            ),

            ...extraireValeurs(
                agent.specialites
            ),

            ...extraireValeurs(
                agent.competences
            ),

            ...extraireValeurs(
                agent.engagement
            ),

            ...extraireValeurs(
                agent.regime
            )
        ]);


    return socleFormations

        .map(f => {

            let quotaRequis =
                Number(f.quota) || 0;


            if (
                Array.isArray(
                    f.modulations
                ) &&
                f.modulations.length > 0
            ) {

                const mod =
                    f.modulations.find(
                        m =>
                            m?.profil &&
                            tousLesProfilsAgent.has(
                                String(
                                    m.profil
                                )
                                    .trim()
                                    .toUpperCase()
                            )
                    );


                if (
                    mod !== undefined &&
                    mod.quota !== undefined
                ) {

                    quotaRequis =
                        Number(
                            mod.quota
                        ) || 0;
                }
            }


            if (quotaRequis === 0) {
                return null;
            }


            const fait =
                heuresAgent[f.id] ||
                heuresAgent[f.libelle] ||
                0;


            const styleClass =
                fait >= quotaRequis
                    ? "fma-done"
                    : (
                        fait > 0
                            ? "fma-partial"
                            : "fma-todo"
                    );


            return `

                <span
                    style="
                        color:#1e40af;
                        font-size:1.1em;
                        font-weight:640;
                    "
                >
                    ${escapeHtml(f.libelle)} :
                </span>

                <span class="${styleClass}">
                    ${fait}/${quotaRequis}h
                </span>

            `;
        })

        .filter(Boolean)

        .join(" | ")

        ||

        `
            <span style="color:#64748b;">
                Aucun socle requis
            </span>
        `;
}


/* ============================================================
   AVANCEMENT SPÉCIALITÉS
   ============================================================ */

function genererAvancementSpecialites(
    agent
) {

    const specAgentBrutes =
        (agent.specialites || [])

            .map(
                s =>
                    s.trim().toUpperCase()
            )

            .filter(Boolean);


    if (!specAgentBrutes.length) {

        return `
            <span style="color:#94a3b8;">
                Aucune spé.
            </span>
        `;
    }


    const specAgentBase =
        specAgentBrutes.map(
            s =>
                s.replace(
                    /\s*\d+$/,
                    ""
                )
        );


    const heuresAgent =
        cumulHeuresParAgent[
            agent.id
        ] || {};


    const formationsSpec =
        catalogueInitial.filter(f => {

            const typeF =
                (f.type || "")
                    .toUpperCase();


            if (
                !typeF.includes("SPEC") &&
                !typeF.includes("SPÉCIALITÉ")
            ) {
                return false;
            }


            const activiteF =
                (f.activite || "")
                    .trim()
                    .toUpperCase();


            const profils = [

                ...(Array.isArray(f.profils)
                    ? f.profils
                    : []),

                ...extraireValeurs(
                    f.modulations
                        ?.map(
                            m =>
                                m?.profil
                        )
                        .filter(Boolean) ||
                    []
                )

            ]

                .map(
                    v =>
                        String(v)
                            .trim()
                            .toUpperCase()
                );


            if (
                profils.length &&
                !profils.includes("TOUS") &&
                !profils.includes(
                    "TOUS PROFILS"
                )
            ) {

                return profils.some(
                    p =>
                        specAgentBrutes.includes(
                            p
                        )
                );
            }


            return (
                activiteF &&
                specAgentBase.includes(
                    activiteF
                )
            );
        });


    if (!formationsSpec.length) {

        return `
            <span style="color:#94a3b8;">
                Aucun suivi requis
            </span>
        `;
    }


    return formationsSpec

        .map(f => {

            const quotaRequis =
                Number(f.quota) || 0;


            if (!quotaRequis) {
                return null;
            }


            const fait =
                heuresAgent[f.id] ||
                heuresAgent[f.libelle] ||
                0;


            const styleClass =
                fait >= quotaRequis
                    ? "fma-done"
                    : (
                        fait > 0
                            ? "fma-partial"
                            : "fma-todo"
                    );


            return `

                <span
                    style="
                        color:#0f172a;
                        font-weight:500;
                    "
                >
                    ${escapeHtml(f.libelle)} :
                </span>

                <span class="${styleClass}">
                    ${fait}/${quotaRequis}h
                </span>

            `;
        })

        .filter(Boolean)

        .join(" | ")

        ||

        `
            <span style="color:#64748b;">
                0/0h
            </span>
        `;
}


/* ============================================================
   EXTRACTION DE VALEURS
   ============================================================ */

function extraireValeurs(champ) {

    if (!champ) return [];


    if (Array.isArray(champ)) {

        return champ

            .flatMap(
                v =>
                    String(v)
                        .split(/[,/;]/)
            )

            .map(
                v =>
                    v.trim()
                        .toUpperCase()
            )

            .filter(Boolean);
    }


    return String(champ)

        .split(/[,/;]/)

        .map(
            v =>
                v.trim()
                    .toUpperCase()
        )

        .filter(Boolean);
}


/* ============================================================
   RECALCUL DE L'HISTORIQUE
   ============================================================ */

function reconstruireCumulsDepuisHistorique() {

    cumulHeuresParAgent = {};


    historiqueSaisiesFMPA.forEach(row => {

        const agent =
            tableauAgentsRH.find(
                a =>
                    a.matricule ===
                    row.matricule
            );


        if (!agent) return;


        const formation =
            trouverFormationHistorique(
                row.formation
            );


        if (!formation) return;


        const duree =
            calculerDureeEntreHeures(
                row.heureDebut,
                row.heureFin
            );


        if (duree <= 0) return;


        if (
            !cumulHeuresParAgent[
                agent.id
            ]
        ) {

            cumulHeuresParAgent[
                agent.id
            ] = {};
        }


        const cle =
            formation.id ||
            formation.libelle;


        cumulHeuresParAgent[
            agent.id
        ][cle] =

            (
                cumulHeuresParAgent[
                    agent.id
                ][cle] || 0
            ) + duree;
    });
}


function trouverFormationHistorique(
    valeur
) {

    const texte =
        valeurTexte(valeur);


    return catalogueInitial.find(
        f =>
            f.id === texte ||
            f.libelle === texte
    );
}


/* ============================================================
   SÉLECTION DES AGENTS
   ============================================================ */

function toggleAgent(idAgent) {

    if (
        agentsSelectionnes.has(
            idAgent
        )
    ) {

        agentsSelectionnes.delete(
            idAgent
        );

    } else {

        agentsSelectionnes.add(
            idAgent
        );
    }


    filtrerEtAfficherTableau();
}


function basculerToutSelectionner(
    e
) {

    const isChecked =
        e.target.checked;


    const checkboxes =
        document.querySelectorAll(
            ".chk-agent"
        );


    checkboxes.forEach(chk => {

        chk.checked =
            isChecked;


        if (isChecked) {

            agentsSelectionnes.add(
                chk.value
            );

        } else {

            agentsSelectionnes.delete(
                chk.value
            );
        }
    });


    filtrerEtAfficherTableau();
}


function majStatutSelection() {

    const count =
        agentsSelectionnes.size;


    document.getElementById(
        "selection-status"
    ).textContent =
        `👥 ${count} agent(s) sélectionné(s)`;


    document.getElementById(
        "btn-valider-groupe"
    ).disabled =
        count === 0 ||
        !classeurXLSX;
}


/* ============================================================
   VALIDATION D'UNE FORMATION
   ============================================================ */

async function validerSaisieGroupee(e) {

    e.preventDefault();


    if (!classeurXLSX) {

        alert(
            "Ouvrez d'abord FMPA-RH.xlsx."
        );

        return;
    }


    const duree =
        calculerDuree();


    const dateFormation =
        document.getElementById(
            "saisie-date"
        ).value;


    const heureDebut =
        document.getElementById(
            "saisie-heure-debut"
        ).value;


    const heureFin =
        document.getElementById(
            "saisie-heure-fin"
        ).value;


    const idFormation =
        document.getElementById(
            "saisie-theme"
        ).value;


    const formateur =
        document.getElementById(
            "saisie-formateur"
        ).value.trim();


    const lieu =
        document.getElementById(
            "saisie-lieu"
        ).value.trim();


    const commentaires =
        document.getElementById(
            "saisie-commentaires"
        ).value.trim();


    if (!agentsSelectionnes.size) {

        alert(
            "Veuillez sélectionner au moins un agent."
        );

        return;
    }


    if (
        !dateFormation ||
        !idFormation ||
        duree <= 0
    ) {

        alert(
            "Veuillez sélectionner une formation valide et renseigner une durée."
        );

        return;
    }


    const formationObj =
        catalogueInitial.find(
            f =>
                f.id === idFormation
        );


    if (!formationObj) {

        alert(
            "La formation sélectionnée n'a pas été retrouvée dans l'onglet catalogue."
        );

        return;
    }


    /*
     * L'onglet historiqueSuivi ne possède
     * pas de colonne Lieu.
     *
     * On conserve donc le lieu dans
     * Commentaires.
     */

    const commentaireFinal =
        lieu

            ? `${commentaires}${commentaires ? " — " : ""}Lieu : ${lieu}`

            : commentaires;


    const dateSaisie =
        obtenirDateSaisie();


    agentsSelectionnes.forEach(
        idAgent => {

            const agent =
                tableauAgentsRH.find(
                    a =>
                        a.id === idAgent
                );


            if (!agent) return;


            historiqueSaisiesFMPA.push({

                matricule:
                    agent.matricule,

                date:
                    dateFormation,

                heureDebut:
                    heureDebut,

                heureFin:
                    heureFin,

                formation:
                    formationObj.libelle,

                formateur:
                    formateur,

                commentaires:
                    commentaireFinal,

                dateSaisie:
                    dateSaisie
            });


            if (
                !cumulHeuresParAgent[
                    idAgent
                ]
            ) {

                cumulHeuresParAgent[
                    idAgent
                ] = {};
            }


            const cle =
                formationObj.id;


            cumulHeuresParAgent[
                idAgent
            ][cle] =

                (
                    cumulHeuresParAgent[
                        idAgent
                    ][cle] || 0
                ) + duree;
        }
    );


    reconstruireFeuilleHistorique();


    const nombreAgents =
        agentsSelectionnes.size;


    agentsSelectionnes.clear();


    document.getElementById(
        "select-all"
    ).checked = false;


    filtrerEtAfficherTableau();


    /*
     * Sauvegarde automatique si le fichier
     * a été ouvert avec File System Access API.
     */

    if (fichierHandleXLSX) {

        try {

            await enregistrerFichierXLSX();


            alert(
                `Saisie enregistrée et fichier Excel sauvegardé.\n` +
                `${duree}h ajoutée(s) pour ${nombreAgents} agent(s).`
            );

        }

        catch (err) {

            console.error(err);


            alert(
                `La saisie est en mémoire mais la sauvegarde Excel a échoué.\n` +
                `${err.message}`
            );
        }

    }

    else {

        document.getElementById(
            "btn-save-xlsx"
        ).disabled = false;


        alert(
            `Saisie enregistrée en mémoire.\n` +
            `Utilisez "Enregistrer FMPA-RH.xlsx" pour sauvegarder.`
        );
    }
}


/* ============================================================
   RECONSTRUCTION DE L'ONGLET HISTORIQUE
   ============================================================ */

function reconstruireFeuilleHistorique() {

    if (!classeurXLSX) return;


    const donnees = [

        HEADERS_HISTORIQUE,

        ...historiqueSaisiesFMPA.map(
            row => [

                row.matricule,

                row.date,

                row.heureDebut,

                row.heureFin,

                row.formation,

                row.formateur,

                row.commentaires,

                row.dateSaisie
            ]
        )
    ];


    classeurXLSX.Sheets.historiqueSuivi =
        XLSX.utils.aoa_to_sheet(
            donnees
        );
}


/* ============================================================
   SAUVEGARDE EXCEL
   ============================================================ */

async function enregistrerFichierXLSX() {

    if (!classeurXLSX) {

        alert(
            "Aucun classeur Excel n'est chargé."
        );

        return;
    }


    reconstruireFeuilleHistorique();


    const buffer =
        XLSX.write(
            classeurXLSX,
            {
                bookType: "xlsx",
                type: "array"
            }
        );


    /*
     * Sauvegarde directe dans le fichier
     * précédemment ouvert.
     */

    if (fichierHandleXLSX) {

        const writable =
            await fichierHandleXLSX
                .createWritable();


        try {

            await writable.write(
                buffer
            );

            await writable.close();

        }

        catch (err) {

            try {

                await writable.abort();

            }

            catch (_) {}

            throw err;
        }


        afficherStatut(
            `🟢 ${nomFichierXLSX} sauvegardé — ` +
            `${new Date().toLocaleTimeString("fr-FR")}`
        );


        return;
    }


    /*
     * Solution de secours :
     * téléchargement d'un nouveau fichier.
     */

    const blob =
        new Blob(
            [buffer],
            {
                type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href = url;

    link.download =
        nomFichierXLSX ||
        "FMPA-RH.xlsx";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );


    afficherStatut(
        `🟢 ${nomFichierXLSX} exporté — ` +
        `sélectionnez le fichier pour la prochaine session.`
    );
}


/* ============================================================
   DATE DE SAISIE AUTOMATIQUE
   ============================================================ */

function obtenirDateSaisie() {

    const maintenant =
        new Date();


    const pad =
        n =>
            String(n).padStart(
                2,
                "0"
            );


    return (

        `${maintenant.getFullYear()}-` +

        `${pad(
            maintenant.getMonth() + 1
        )}-` +

        `${pad(
            maintenant.getDate()
        )} ` +

        `${pad(
            maintenant.getHours()
        )}:` +

        `${pad(
            maintenant.getMinutes()
        )}:` +

        `${pad(
            maintenant.getSeconds()
        )}`
    );
}


/* ============================================================
   MESSAGE DE STATUT
   ============================================================ */

function afficherStatut(
    message,
    erreur = false
) {

    const element =
        document.getElementById(
            "xlsx-status"
        );


    if (!element) return;


    element.textContent =
        message;


    element.style.background =
        erreur
            ? "#fee2e2"
            : "#f1f5f9";


    element.style.color =
        erreur
            ? "#991b1b"
            : "#475569";
}


/* ============================================================
   SÉCURITÉ AFFICHAGE HTML
   ============================================================ */

function escapeHtml(value) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


function escapeJs(value) {

    return String(
        value ?? ""
    )

        .replace(
            /\\/g,
            "\\\\"
        )

        .replace(
            /'/g,
            "\\'"
        );
}
