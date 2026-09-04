let agentsLocaux = [];
let propositionsEnAttente = [];

const ORDRE_FONCTIONS = ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEQU', 'EQU'];

/**
 * Importation manuelle Excel
 */
function importerFichierExcelManuel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        traiterDonneesExcel(arrayBuffer);
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Recherche dynamique d'une clé dans un objet (tolérant à la casse et aux espaces)
 */
function obtenirValeurChamp(item, clesPossibles) {
    const clesObjet = Object.keys(item);
    for (const cle of clesObjet) {
        const cleNormalisee = normaliserTexte(cle);
        for (const possible of clesPossibles) {
            if (cleNormalisee === normaliserTexte(possible)) {
                return item[cle];
            }
        }
    }
    return "";
}

/**
 * Traitement Excel
 */
function traiterDonneesExcel(arrayBuffer) {
    try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const premierNomFeuille = workbook.SheetNames[0];
        const feuille = workbook.Sheets[premierNomFeuille];

        const donneesBrutes = XLSX.utils.sheet_to_json(feuille, { defval: "" });

        const tousLesAgents = donneesBrutes.map(item => {
            const spec = obtenirValeurChamp(item, [
                "SPECIALITE", "SPECIALITES", "SPÉCIALITÉ", "SPÉCIALITÉS", 
                "FOR_SPECIALITE", "FOR_SPECIALITES", "SPEC", "SPECS"
            ]);

            const comp = obtenirValeurChamp(item, [
                "COMPETENCE", "COMPETENCES", "COMPÉTENCE", "COMPÉTENCES", 
                "FOR_COMPETENCE", "FOR_COMPETENCES", "COMP", "COMPS"
            ]);

            return {
                matricule: String(obtenirValeurChamp(item, ["MATRICULE", "MATRICULES"])),
                nom: String(obtenirValeurChamp(item, ["NOM"])),
                prenom: String(obtenirValeurChamp(item, ["PRENOM", "PRÉNOM"])),
                grade: String(obtenirValeurChamp(item, ["GRADE"])),
                fonction: String(obtenirValeurChamp(item, ["FONCTION"])),
                equipe: String(obtenirValeurChamp(item, ["EQUIPE", "ÉQUIPE"])),
                statut: String(obtenirValeurChamp(item, ["STATUT"])),
                sexe: String(obtenirValeurChamp(item, ["SEXE", "GENRE"])),
                dateNaissance: obtenirValeurChamp(item, ["DATE_NAISSANCE", "DATE NAISSANCE", "NAISSANCE"]),
                regime: String(obtenirValeurChamp(item, ["REGIME", "RÉGIME", "REGIME_TRAVAIL"])),
                codePostal: String(obtenirValeurChamp(item, ["CP", "CODE POSTAL"])),
                commune: String(obtenirValeurChamp(item, ["COMMUNE"])),
                domiciliation: String(obtenirValeurChamp(item, ["DOMICILIATION"])),
                adresse: String(obtenirValeurChamp(item, ["ADRESSE"])),
                departement: String(obtenirValeurChamp(item, ["DEPARTEMENT", "DÉPARTEMENT"])),
                specialites: String(spec || ""),
                competences: String(comp || "")
            };
        });

        agentsLocaux = tousLesAgents.filter(a => {
            if (!a) return false;
            const eq = normaliserTexte(a.equipe);
            const fn = normaliserTexte(a.fonction);
            const st = normaliserTexte(a.statut);
            const estCadre = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'ADMINISTRATIF'].includes(fn) || eq.includes('ENCADREMENT');
            return st.includes('SPP') && !estCadre;
        });

        agentsLocaux.forEach((a, index) => {
            if (!a.idUnique) a.idUnique = a.matricule || `agent_${index}`;
            if (a.verrouille === undefined) a.verrouille = false;
        });

        genererControlesDynamiques();
        rendreEquipes();
    } catch (err) {
        alert("⚠️ Erreur lors de la lecture du fichier Excel.");
        console.error(err);
    }
}

function estFemme(agent) {
    if (!agent || !agent.sexe) return false;
    const val = String(agent.sexe).trim().toLowerCase();
    return val === 'femme' || val === 'f';
}

function traiterNomItem(itemStr, conserverNiveau = true) {
    if (!itemStr) return '';
    const nettoye = itemStr.trim().toUpperCase();
    if (conserverNiveau) return nettoye; 
    return nettoye.replace(/\d+$/, ''); 
}

function normaliserTexte(txt) {
    if (!txt) return "";
    return txt.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function extraireLettreEquipe(nomEquipe) {
    const norm = normaliserTexte(nomEquipe);
    if (norm.includes('A')) return 'A';
    if (norm.includes('B')) return 'B';
    if (norm.includes('C')) return 'C';
    return '';
}

function calculerAge(dateNaissance) {
    if (!dateNaissance) return 35;
    const d = new Date(dateNaissance);
    if (isNaN(d.getTime())) return 35;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function extraireDepartement(agent) {
    const texte = `${agent.codePostal || ''} ${agent.commune || ''} ${agent.domiciliation || ''} ${agent.adresse || ''}`;
    const match = texte.match(/\b(2[AB]|\d{2})\d{3}\b/);
    if (match) return match[1];
    if (agent.departement) return agent.departement.toString().trim();
    return "ND";
}

function extraireItems(chaine) {
    if (!chaine) return [];
    return chaine.split(/[,;\/-]+/).map(s => normaliserTexte(s)).filter(s => s.length > 0);
}

function genererControlesDynamiques() {
    const ensembleSpecs = new Set();
    const ensembleComps = new Set();

    agentsLocaux.forEach(a => {
        extraireItems(a.specialites).forEach(s => ensembleSpecs.add(s));
        extraireItems(a.competences).forEach(c => ensembleComps.add(c));
    });

    const containerSpecs = document.getElementById("container-reglages-specs");
    const containerComps = document.getElementById("container-reglages-comps");

    if (containerSpecs) {
        containerSpecs.innerHTML = "";
        Array.from(ensembleSpecs).sort().forEach(spec => {
            const id = `poids-spec-${spec}`;
            containerSpecs.innerHTML += `
                <div class="reglage-group">
                    <label><span>${spec}</span> : <span id="val-${id}">5</span></label>
                    <input type="range" id="${id}" data-item="${spec}" class="input-poids-spec" min="0" max="5" value="5" oninput="document.getElementById('val-${id}').innerText=this.value">
                </div>
            `;
        });
    }

    if (containerComps) {
        containerComps.innerHTML = "";
        Array.from(ensembleComps).sort().forEach(comp => {
            const id = `poids-comp-${comp}`;
            containerComps.innerHTML += `
                <div class="reglage-group">
                    <label><span>${comp}</span> : <span id="val-${id}">5</span></label>
                    <input type="range" id="${id}" data-item="${comp}" class="input-poids-comp" min="0" max="5" value="5" oninput="document.getElementById('val-${id}').innerText=this.value">
                </div>
            `;
        });
    }
}

function trierAgentsHierarchie(a, b) {
    const ordreFonctions = {
        'CDG': 1, 'ACDG1': 2, 'ACDG2': 3, 
        'CATE': 4, 'CA1E': 5, 'CEQU': 6, 'EQU': 7
    };

    const ordreGrades = {
        'CDT': 1, 'CNE': 2, 'LTN': 3, 'ADC': 4, 'ADJ': 5, 'SCH': 6, 'SGT': 7,
        'CCH': 8, 'CPL': 9, 'SAP': 10
    };
    
    const fA = String(a?.fonction || '').trim().toUpperCase();
    const fB = String(b?.fonction || '').trim().toUpperCase();

    const rankFnA = ordreFonctions[fA] || 99;
    const rankFnB = ordreFonctions[fB] || 99;

    if (rankFnA !== rankFnB) return rankFnA - rankFnB;

    const gA = String(a?.grade || '').trim().toUpperCase();
    const gB = String(b?.grade || '').trim().toUpperCase();

    const rankGdaA = ordreGrades[gA] || 99;
    const rankGdaB = ordreGrades[gB] || 99;

    if (rankGdaA !== rankGdaB) return rankGdaA - rankGdaB;

    const nomA = String(a?.nom || '').localeCompare(String(b?.nom || ''));
    if (nomA !== 0) return nomA;

    return String(a?.prenom || '').localeCompare(String(b?.prenom || ''));
}

function calculerStatsEquipe(membres, conserverNiveaux = true) {
    const nb = membres.length;
    
    const nbF = membres.filter(a => estFemme(a)).length;
    const pctF = nb > 0 ? Math.round((nbF / nb) * 100) : 0;
    
    const ageMoy = nb > 0 ? Math.round(membres.reduce((s, a) => {
        return s + (a.dateNaissance ? calculerAge(a.dateNaissance) : 0);
    }, 0) / nb) : 0;
    
    const compteFnStricte = (fn) => membres.filter(a => String(a?.fonction || '').trim().toUpperCase() === fn.toUpperCase()).length;

    const cdg = compteFnStricte('CDG');
    const acdg = compteFnStricte('ACDG1') + compteFnStricte('ACDG2');
    const cate = compteFnStricte('CATE');
    const ca1e = compteFnStricte('CA1E');
    const cequ = compteFnStricte('CEQU');
    const equ = compteFnStricte('EQU');

    const getRegime = (a) => String(a?.regime || '').toLowerCase();
    const nbG24 = membres.filter(a => getRegime(a).includes('g24')).length;
    const nbMixte = membres.filter(a => getRegime(a).includes('mixte')).length;

    const dicSpecs = {};
    const dicComps = {};
    const dicDept = {};

    membres.forEach(a => {
        extraireItems(a.specialites).forEach(s => {
            const cle = traiterNomItem(s, conserverNiveaux);
            if (cle) dicSpecs[cle] = (dicSpecs[cle] || 0) + 1;
        });
        
        extraireItems(a.competences).forEach(c => {
            const cle = traiterNomItem(c, conserverNiveaux);
            if (cle) dicComps[cle] = (dicComps[cle] || 0) + 1;
        });
        
        const dep = extraireDepartement(a);
        if (dep) dicDept[dep] = (dicDept[dep] || 0) + 1;
    });

    return { 
        nb, nbF, pctF, ageMoy,
        nbG24, nbMixte,
        cdg,
        acdgCate: acdg + cate,
        ca1e, cequ, equ,
        dicSpecs, dicComps, dicDept
    };
}

function genererBadgesHTML(dictionnaire, couleurHex) {
    if (!dictionnaire || Object.keys(dictionnaire).length === 0) {
        return '<span style="color:#6b7280; font-size:0.8em;">Aucun</span>';
    }

    const clefsTriees = Object.keys(dictionnaire).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    return clefsTriees.map(cle => {
        const val = dictionnaire[cle];
        return `<span style="
            display: inline-block;
            padding: 2px 6px;
            margin: 2px;
            border-radius: 4px;
            font-size: 0.6rem;
            border: 1px solid ${couleurHex};
            background-color: ${couleurHex}20;
            color: #ffffff;
        ">${cle}:<strong style="color:${couleurHex}; margin-left:2px;">${val}</strong></span>`;
    }).join('');
}

function rendreEquipes() {
    const lettresEquipes = ['A', 'B', 'C'];
    const chkNiveaux = document.getElementById("chk-conserver-niveaux");
    const conserverNiveaux = chkNiveaux ? chkNiveaux.checked : true;

    lettresEquipes.forEach(lettre => {
        const membres = agentsLocaux.filter(a => a && a.equipe && extraireLettreEquipe(a.equipe) === lettre);
        membres.sort(trierAgentsHierarchie);

        const s = calculerStatsEquipe(membres, conserverNiveaux);
        
        const countEl = document.getElementById(`count-${lettre}`);
        if (countEl) countEl.innerText = s.nb;

        const statsEl = document.getElementById(`stats-${lettre}`);
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-badge"><span class="stat-label">Femmes:</span> <span class="stat-value">${s.nbF}</span></div>
                <div class="stat-badge"><span class="stat-label">Âge moy:</span> <span class="stat-value">${s.ageMoy} ans</span></div>
                <div class="stat-badge"><span class="stat-label">CDG:</span> <span class="stat-value">${s.cdg}</span></div>
                <div class="stat-badge"><span class="stat-label">ACDG/CATE:</span> <span class="stat-value">${s.acdgCate}</span></div>
                <div class="stat-badge"><span class="stat-label">CA1E:</span> <span class="stat-value">${s.ca1e}</span></div>
                <div class="stat-badge"><span class="stat-label">CEqu:</span> <span class="stat-value">${s.cequ}</span></div>
                <div class="stat-badge"><span class="stat-label">Equ:</span> <span class="stat-value">${s.equ}</span></div>

                <div class="stat-badge"><span class="stat-label">G24:</span> <span class="stat-value" style="color:#60a5fa;">${s.nbG24}</span></div>
                <div class="stat-badge"><span class="stat-label">Mixte:</span> <span class="stat-value" style="color:#f59e0b;">${s.nbMixte}</span></div>

                <div class="stat-section-title">Spécialités :</div>
                <div class="stat-badge-container">${genererBadgesHTML(s.dicSpecs, '#60a5fa')}</div>

                <div class="stat-section-title">Compétences :</div>
                <div class="stat-badge-container">${genererBadgesHTML(s.dicComps, '#34d399')}</div>

                <div class="stat-section-title">Départements Domicile :</div>
                <div class="stat-badge-container">${genererBadgesHTML(s.dicDept, '#f59e0b')}</div>`;
        }

        const container = document.getElementById(`container-${lettre}`);
        if (container) {
            container.innerHTML = "";
            membres.forEach(agent => {
                const specs = agent.specialites ? `<span class="agent-spec">[${agent.specialites}]</span>` : '';
                const dep = extraireDepartement(agent);
                
                const optionsDeplacement = lettresEquipes
                    .filter(l => l !== lettre)
                    .map(l => `<option value="Équipe ${l}">Vers ${l}</option>`)
                    .join('');

                container.innerHTML += `
                    <div class="carte-agent-simu ${agent.verrouille ? 'locked' : ''}">
                        <div class="agent-info-compact">
                            <span class="agent-nom">${(agent.nom || '').toUpperCase()} ${agent.prenom || ''}</span>
                            <div class="agent-details">
                                <span>${agent.fonction || 'Agent'}</span>
                                <span>${agent.grade || '-'}</span>
                                <span style="color:#f59e0b;">Dép:${dep}</span>
                                ${specs}
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <input type="checkbox" title="Verrouiller" ${agent.verrouille ? 'checked' : ''} onchange="basculerVerrou('${agent.idUnique}')">
                            <select class="select-equipe-deplacement" onchange="deplacerAgent('${agent.idUnique}', this.value)">
                                <option value="">Déplacer...</option>
                                ${optionsDeplacement}
                            </select>
                        </div>
                    </div>
                `;
            });
        }
    });
}

function calculerScorePenalite(equipes, conserverNiveaux = true) {
    const stats = equipes.map(e => calculerStatsEquipe(e, conserverNiveaux));
    
    const evaluerEcart = (getValeur) => {
        const vals = stats.map(getValeur);
        const moy = vals.reduce((a, b) => a + b, 0) / 3;
        return vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0);
    };

    const p1 = parseInt(document.getElementById("poids-effectif")?.value || 10, 10);
    const p2 = parseInt(document.getElementById("poids-genre")?.value || 9, 10);
    const p3 = parseInt(document.getElementById("poids-cdg")?.value || 8, 10);
    const p4 = parseInt(document.getElementById("poids-cate")?.value || 7, 10);
    const p5 = parseInt(document.getElementById("poids-equ")?.value || 6, 10);
    const p6 = parseInt(document.getElementById("poids-specs")?.value || 5, 10);
    const p7 = parseInt(document.getElementById("poids-comps")?.value || 4, 10);
    const p8 = parseInt(document.getElementById("poids-regimes")?.value || 3, 10);
    const p9 = parseInt(document.getElementById("poids-age")?.value || 2, 10);
    const p10 = parseInt(document.getElementById("poids-dept")?.value || 1, 10);

    let scorePena = 0;

    scorePena += evaluerEcart(s => s.nb) * (p1 * 10);
    scorePena += evaluerEcart(s => s.nbF) * (p2 * 10);
    scorePena += evaluerEcart(s => s.cdg) * (p3 * 10);
    scorePena += evaluerEcart(s => s.acdgCate) * (p4 * 10);
    scorePena += evaluerEcart(s => s.cequ + s.equ) * (p5 * 10);
    
    const toutesSpecs = new Set(stats.flatMap(s => Object.keys(s.dicSpecs)));
    toutesSpecs.forEach(spec => {
        scorePena += evaluerEcart(s => s.dicSpecs[spec] || 0) * (p6 * 10);
    });

    const toutesComps = new Set(stats.flatMap(s => Object.keys(s.dicComps)));
    toutesComps.forEach(comp => {
        scorePena += evaluerEcart(s => s.dicComps[comp] || 0) * (p7 * 10);
    });

    scorePena += evaluerEcart(s => s.nbG24) * (p8 * 10);
    scorePena += evaluerEcart(s => parseFloat(s.ageMoy)) * (p9 * 10);

    const tousDepts = new Set(stats.flatMap(s => Object.keys(s.dicDept)));
    tousDepts.forEach(dep => {
        scorePena += evaluerEcart(s => s.dicDept[dep] || 0) * (p10 * 10);
    });

    return scorePena;
}

function suggererReequilibrage() {
    if (agentsLocaux.length === 0) {
        alert("⚠️ Veuillez d'abord charger votre fichier Excel.");
        return;
    }

    propositionsEnAttente = [];

    const chkNiveaux = document.getElementById("chk-conserver-niveaux");
    const conserverNiveaux = chkNiveaux ? chkNiveaux.checked : true;

    // Simulation basée sur l'état ACTUEL des agents
    let etatSimule = JSON.parse(JSON.stringify(agentsLocaux));

    const lettres = ['A', 'B', 'C'];
    const maxIterations = 20;

    for (let iter = 0; iter < maxIterations; iter++) {
        let eqA = etatSimule.filter(a => extraireLettreEquipe(a.equipe) === 'A');
        let eqB = etatSimule.filter(a => extraireLettreEquipe(a.equipe) === 'B');
        let eqC = etatSimule.filter(a => extraireLettreEquipe(a.equipe) === 'C');

        let scoreActuel = calculerScorePenalite([eqA, eqB, eqC], conserverNiveaux);
        let meilleurScore = scoreActuel;
        let meilleurMouvement = null;

        const dics = { 'A': eqA, 'B': eqB, 'C': eqC };

        // 1. TESTER LES TRANSFERTS DIRECTS
        lettres.forEach(source => {
            lettres.forEach(cible => {
                if (source !== cible) {
                    const candidats = dics[source].filter(a => !a.verrouille);
                    candidats.forEach(agent => {
                        const simA = eqA.map(a => a.idUnique === agent.idUnique ? { ...a, equipe: `Équipe ${cible}` } : a);
                        const simB = eqB.map(a => a.idUnique === agent.idUnique ? { ...a, equipe: `Équipe ${cible}` } : a);
                        const simC = eqC.map(a => a.idUnique === agent.idUnique ? { ...a, equipe: `Équipe ${cible}` } : a);

                        const testA = source === 'A' ? simA.filter(a => a.idUnique !== agent.idUnique) : (cible === 'A' ? [...simA, { ...agent, equipe: 'Équipe A' }] : simA);
                        const testB = source === 'B' ? simB.filter(a => a.idUnique !== agent.idUnique) : (cible === 'B' ? [...simB, { ...agent, equipe: 'Équipe B' }] : simB);
                        const testC = source === 'C' ? simC.filter(a => a.idUnique !== agent.idUnique) : (cible === 'C' ? [...simC, { ...agent, equipe: 'Équipe C' }] : simC);

                        const testScore = calculerScorePenalite([testA, testB, testC], conserverNiveaux);

                        if (testScore < meilleurScore - 0.05) { // Seuil minimal d'amélioration
                            meilleurScore = testScore;
                            meilleurMouvement = {
                                type: 'TRANSFERT',
                                agent: agent,
                                eqSource: source,
                                eqCible: cible,
                                gain: scoreActuel - testScore
                            };
                        }
                    });
                }
            });
        });

        // 2. TESTER LES ÉCHANGES 1 CONTRE 1
        if (!meilleurMouvement) {
            const testerPaireEchange = (eq1, eq2, nom1, nom2) => {
                const mob1 = eq1.filter(a => !a.verrouille);
                const mob2 = eq2.filter(a => !a.verrouille);

                mob1.forEach(a1 => {
                    mob2.forEach(a2 => {
                        const simA = eqA.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));
                        const simB = eqB.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));
                        const simC = eqC.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));

                        const testScore = calculerScorePenalite([simA, simB, simC], conserverNiveaux);

                        if (testScore < meilleurScore - 0.05) {
                            meilleurScore = testScore;
                            meilleurMouvement = {
                                type: 'ECHANGE',
                                a1: a1,
                                a2: a2,
                                eq1: nom1,
                                eq2: nom2,
                                gain: scoreActuel - testScore
                            };
                        }
                    });
                });
            };

            testerPaireEchange(eqA, eqB, 'A', 'B');
            testerPaireEchange(eqB, eqC, 'B', 'C');
            testerPaireEchange(eqA, eqC, 'A', 'C');
        }

        // Enregistrement et application de la simulation
        if (meilleurMouvement) {
            if (meilleurMouvement.type === 'TRANSFERT') {
                const target = etatSimule.find(a => a.idUnique === meilleurMouvement.agent.idUnique);
                if (target) target.equipe = `Équipe ${meilleurMouvement.eqCible}`;

                propositionsEnAttente.push({
                    type: 'TRANSFERT',
                    a1: meilleurMouvement.agent,
                    eqCible: meilleurMouvement.eqCible,
                    motif: `Transfert Équipe ${meilleurMouvement.eqSource} ➡️ Équipe ${meilleurMouvement.eqCible}`
                });
            } else if (meilleurMouvement.type === 'ECHANGE') {
                const target1 = etatSimule.find(a => a.idUnique === meilleurMouvement.a1.idUnique);
                const target2 = etatSimule.find(a => a.idUnique === meilleurMouvement.a2.idUnique);
                if (target1 && target2) {
                    const temp = target1.equipe;
                    target1.equipe = target2.equipe;
                    target2.equipe = temp;
                }

                propositionsEnAttente.push({
                    type: 'ECHANGE',
                    a1: meilleurMouvement.a1,
                    a2: meilleurMouvement.a2,
                    motif: `Échange Équipe ${meilleurMouvement.eq1} 🔄 Équipe ${meilleurMouvement.eq2}`
                });
            }
        } else {
            break;
        }
    }

    afficherPropositions();
}

function afficherPropositions() {
    if (propositionsEnAttente.length === 0) {
        alert("✅ Équilibre maximal atteint ! Aucun autre mouvement pertinent à proposer.");
        return;
    }

    const listeUI = document.getElementById("liste-propositions");
    if (!listeUI) return;

    listeUI.innerHTML = propositionsEnAttente.map((p, index) => {
        if (p.type === 'TRANSFERT') {
            return `<li style="margin-bottom:10px;"><b>#${index + 1}</b> ➡️ Transférer <b>${p.a1.nom} ${p.a1.prenom}</b> vers l'<b>Équipe ${p.eqCible}</b><br><span style="font-size:0.75rem; color:#94a3b8;">${p.motif}</span></li>`;
        } else {
            return `<li style="margin-bottom:10px;"><b>#${index + 1}</b> 🔄 Échanger <b>${p.a1.nom} ${p.a1.prenom}</b> avec <b>${p.a2.nom} ${p.a2.prenom}</b><br><span style="font-size:0.75rem; color:#94a3b8;">${p.motif}</span></li>`;
        }
    }).join("");

    const modal = document.getElementById("modal-transferts");
    if (modal) modal.style.display = "flex";
}

function fermerModal() { document.getElementById("modal-transferts").style.display = "none"; }

function appliquerPropositions() {
    // Met à jour la VRAIE liste agentsLocaux
    propositionsEnAttente.forEach(p => {
        if (p.type === 'TRANSFERT') {
            const ag = agentsLocaux.find(a => a.idUnique === p.a1.idUnique);
            if (ag) ag.equipe = `Équipe ${p.eqCible}`;
        } else if (p.type === 'ECHANGE') {
            const ag1 = agentsLocaux.find(a => a.idUnique === p.a1.idUnique);
            const ag2 = agentsLocaux.find(a => a.idUnique === p.a2.idUnique);
            if (ag1 && ag2) {
                const eqTemp = ag1.equipe;
                ag1.equipe = ag2.equipe;
                ag2.equipe = eqTemp;
            }
        }
    });

    propositionsEnAttente = [];
    fermerModal();
    rendreEquipes(); // Réaffiche la grille avec les nouveaux effectifs réels
}

function basculerVerrou(idUnique) {
    const ag = agentsLocaux.find(a => a.idUnique === idUnique);
    if (ag) ag.verrouille = !ag.verrouille;
    rendreEquipes();
}

function deplacerAgent(idUnique, nouvelleEquipe) {
    if (!nouvelleEquipe) return;
    const ag = agentsLocaux.find(a => a.idUnique === idUnique);
    if (ag) ag.equipe = nouvelleEquipe;
    rendreEquipes();
}
