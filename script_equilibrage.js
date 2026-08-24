let agentsLocaux = [];
let propositionsEnAttente = [];

// ORDRE HIÉRARCHIQUE DES FONCTIONS EXACT : CDG -> ACDG1 -> ACDG2 -> CATE -> CA1E -> CEQU -> EQU
const ORDRE_FONCTIONS = ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEQU', 'EQU'];

document.addEventListener("DOMContentLoaded", () => {
    const data = localStorage.getItem("baseAgents");
    
    if (!data) {
        console.warn("⚠️ Aucune donnée 'baseAgents' trouvée dans le localStorage.");
        alert("Attention : Aucune donnée d'agent n'a été trouvée. Veuille réimporter ton fichier CSV depuis la page principale.");
        return;
    }

    try {
        const tousLesAgents = JSON.parse(data);
        
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
    } catch (e) {
        console.error("Erreur de lecture des données :", e);
        alert("Erreur lors de la lecture des données d'agents. Réimportation du CSV requise.");
    }
});

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
    return chaine.split(/[,;\/-]+/).map(s => normaliserTexte(s)).filter(s => s.length > 1);
}

/**
 * Génère automatiquement une barre de pondération pour CHAQUE spécialité 
 * et CHAQUE compétence présente dans les données des agents.
 */
function genererControlesDynamiques() {
    const ensembleSpecs = new Set();
    const ensembleComps = new Set();

    agentsLocaux.forEach(a => {
        extraireItems(a.specialites).forEach(s => ensembleSpecs.add(s));
        extraireItems(a.competences).forEach(c => ensembleComps.add(c));
    });

    const containerSpecs = document.getElementById("container-reglages-specs");
    const containerComps = document.getElementById("container-reglages-comps");

    containerSpecs.innerHTML = "";
    Array.from(ensembleSpecs).sort().forEach(spec => {
        const id = `poids-spec-${spec}`;
        containerSpecs.innerHTML += `
            <div class="reglage-group">
                <label><span>${spec}</span> : <span id="val-${id}">3</span></label>
                <input type="range" id="${id}" data-item="${spec}" class="input-poids-spec" min="0" max="5" value="3" oninput="document.getElementById('val-${id}').innerText=this.value">
            </div>
        `;
    });

    containerComps.innerHTML = "";
    Array.from(ensembleComps).sort().forEach(comp => {
        const id = `poids-comp-${comp}`;
        containerComps.innerHTML += `
            <div class="reglage-group">
                <label><span>${comp}</span> : <span id="val-${id}">3</span></label>
                <input type="range" id="${id}" data-item="${comp}" class="input-poids-comp" min="0" max="5" value="3" oninput="document.getElementById('val-${id}').innerText=this.value">
            </div>
        `;
    });
}

function trierAgentsHierarchie(a, b) {
    const fA = normaliserTexte(a.fonction);
    const fB = normaliserTexte(b.fonction);
     idxFA = ORDRE_FONCTIONS.indexOf(fA);
     idxFB = ORDRE_FONCTIONS.indexOf(fB);
    
    if (idxFA === -1) idxFA = 999;
    if (idxFB === -1) idxFB = 999;
    
    if (idxFA !== idxFB) return idxFA - idxFB;

    const nomA = normaliserTexte(a.nom);
    const nomB = normaliserTexte(b.nom);
    if (nomA !== nomB) return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
    
    return normaliserTexte(a.prenom).localeCompare(normaliserTexte(b.prenom), 'fr', { sensitivity: 'base' });
}

function calculerStatsEquipe(membres) {
    const nb = membres.length;
    const nbF = membres.filter(a => normaliserTexte(a.sexe).startsWith('F') || normaliserTexte(a.genre).startsWith('F')).length;
    const ageMoy = nb > 0 ? Math.round(membres.reduce((s, a) => s + calculerAge(a.dateNaissance), 0) / nb) : 0;
    
    const compteFn = (fn) => membres.filter(a => normaliserTexte(a.fonction) === fn).length;

    const dicSpecs = {};
    const dicComps = {};
    const dicDept = {};

    membres.forEach(a => {
        extraireItems(a.specialites).forEach(s => { dicSpecs[s] = (dicSpecs[s] || 0) + 1; });
        extraireItems(a.competences).forEach(c => { dicComps[c] = (dicComps[c] || 0) + 1; });
        const dep = extraireDepartement(a);
        dicDept[dep] = (dicDept[dep] || 0) + 1;
    });

    return { 
        nb, nbF, pctF: nb > 0 ? Math.round((nbF/nb)*100) : 0, ageMoy,
        cate: compteFn('CATE'), ca1e: compteFn('CA1E'),
        cequ: compteFn('CEQU'), equ: compteFn('EQU'),
        cdg: compteFn('CDG') + compteFn('ACDG1') + compteFn('ACDG2'),
        dicSpecs, dicComps, dicDept
    };
}

function genererBadgesHTML(dictionnaire, couleurHex) {
    if (!dictionnaire || Object.keys(dictionnaire).length === 0) {
        return '<span style="color:#6b7280; font-size:0.8em;">Aucun</span>';
    }

    // 1. Déterminer la classe CSS d'origine selon la couleur demandée
    let classeBadge = 'badge-spec'; // Bleue par défaut (#60a5fa)
    if (couleurHex === '#34d399') {
        classeBadge = 'badge-comp';  // Verte
    } else if (couleurHex === '#f59e0b') {
        classeBadge = 'badge-dept';  // Orange
    }

    // 2. Trier les clés par ordre alphabétique / numérique
    const clefsTriees = Object.keys(dictionnaire).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 3. Générer le HTML avec la vraie classe badge d'origine
    return clefsTriees.map(cle => {
        const val = dictionnaire[cle];
        return `<span class="${classeBadge}">${cle}:<strong>${val}</strong></span>`;
    }).join(' ');
}

function rendreEquipes() {
    const lettresEquipes = ['A', 'B', 'C'];

    lettresEquipes.forEach(lettre => {
        // Filtrage des membres de l'équipe courante
        const membres = agentsLocaux.filter(a => a && a.equipe && extraireLettreEquipe(a.equipe) === lettre);
        membres.sort(trierAgentsHierarchie);

        const s = calculerStatsEquipe(membres);
        
        const countEl = document.getElementById(`count-${lettre}`);
        if (countEl) countEl.innerText = s.nb;

        const statsEl = document.getElementById(`stats-${lettre}`);
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-badge full-width"><span class="stat-label">Agents:</span> <span class="stat-value">${s.nb}</span></div>
                <div class="stat-badge"><span class="stat-label">Femmes:</span> <span class="stat-value">${s.nbF} (${s.pctF}%)</span></div>
                <div class="stat-badge"><span class="stat-label">Âge moy:</span> <span class="stat-value">${s.ageMoy} ans</span></div>
                <div class="stat-badge"><span class="stat-label">CDG/ACDG:</span> <span class="stat-value">${s.cdg}</span></div>
                <div class="stat-badge"><span class="stat-label">CATE:</span> <span class="stat-value">${s.cate}</span></div>
                <div class="stat-badge"><span class="stat-label">CA1E:</span> <span class="stat-value">${s.ca1e}</span></div>
                <div class="stat-badge"><span class="stat-label">CEQU:</span> <span class="stat-value">${s.cequ}</span></div>
                <div class="stat-badge full-width"><span class="stat-label">EQU:</span> <span class="stat-value">${s.equ}</span></div>
                
                <div class="stat-section-title">Spécialités :</div>
                <div class="stat-badge-container">${genererBadgesHTML(s.dicSpecs, '#60a5fa')}</div>

                <div class="stat-section-title">Compétences :</div>
                <div class="stat-badge-container">${genererBadgesHTML(s.dicComps, '#34d399')}</div>

                <div class="stat-section-title">Départements Domicile :</div>
                <div class="stat-badge-container">${genererBadgesHTML(s.dicDept, '#f59e0b')}</div>
            `;
        }

        const container = document.getElementById(`container-${lettre}`);
        if (container) {
            container.innerHTML = "";
            membres.forEach(agent => {
                const specs = agent.specialites ? `<span class="agent-spec">[${agent.specialites}]</span>` : '';
                const dep = extraireDepartement(agent);
                
                // Génération des options du select (évite l'erreur de portée de 'lettre')
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

// ALGORITHME FONDÉ SUR CHAQUE BARRE DE PONDÉRATION INDIVIDUELLE
function suggererReequilibrage() {
    propositionsEnAttente = [];
    let tempAgents = JSON.parse(JSON.stringify(agentsLocaux));
    const lettresEquipes = ['A', 'B', 'C'];

    const pCmd = parseInt(document.getElementById("poids-cmd")?.value || 5);
    const pDept = parseInt(document.getElementById("poids-dept")?.value || 3);
    const pGenre = parseInt(document.getElementById("poids-genre")?.value || 2);

    let stats = {};

    // 1. Effectif brut (Correction pour forcer l'équilibre cible)
let totalAgents = tempAgents.filter(a => !a.verrouille).length; // Ne compte que les agents mobiles
let effectifCible = Math.floor(totalAgents / 3);
let reste = totalAgents % 3; // Sera 0, 1, ou 2

lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));

// On boucle pour proposer des transferts tant que l'équilibre n'est pas atteint
let desequilibre = true;
let iterations = 0; // Sécurité pour éviter une boucle infinie

while (desequilibre && iterations < 10) {
    iterations++;
    desequilibre = false;
    
    // Recalculer les stats à chaque itération (virtuellement)
    lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));
    
    let eqTriees = [...lettresEquipes].sort((a,b) => stats[b].nb - stats[a].nb);
    let eqMax = eqTriees[0];
    let eqMin = eqTriees[2];

    // Vérifier si eqMax a plus d'agents que l'effectif cible (plus le reste éventuel)
    // Et si eqMin a moins d'agents que l'effectif cible
    let seuilMax = effectifCible + (reste > 0 ? 1 : 0); // Les plus grosses équipes peuvent avoir effectifCible + 1
    
    if (stats[eqMax].nb > seuilMax || stats[eqMin].nb < effectifCible) {
         // Il y a un déséquilibre
         if (stats[eqMax].nb - stats[eqMin].nb >= 2 || stats[eqMin].nb < effectifCible) {
             desequilibre = true;
             
             // Trouver un candidat 'EQU' non verrouillé dans l'équipe max
             let candidat = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqMax && !a.verrouille && normaliserTexte(a.fonction) === 'EQU');
             
             // Si on ne trouve pas d'EQU, on cherche n'importe qui (optionnel, selon ta logique métier)
             if (!candidat) {
                 candidat = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqMax && !a.verrouille);
             }

             if (candidat) {
                 propositionsEnAttente.push({ 
                     type: 'TRANSFERT', a1: candidat, eqCible: eqMin, 
                     motif: `Rééquilibrage de l'effectif global pour atteindre la cible (${effectifCible} à ${seuilMax})` 
                 });
                 // On applique virtuellement le transfert pour la prochaine itération de la boucle
                 candidat.equipe = `Équipe ${eqMin}`;
             } else {
                 // Impossible de trouver un candidat non verrouillé, on arrête d'essayer
                 desequilibre = false; 
             }
         }
    }
}

    // 2. Commandement
    if (pCmd >= 1) {
        lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));
        let eqTropCATE = lettresEquipes.reduce((a,b) => stats[a].cate > stats[b].cate ? a : b);
        let eqPasAssezCATE = lettresEquipes.reduce((a,b) => stats[a].cate < stats[b].cate ? a : b);

        if (stats[eqTropCATE].cate - stats[eqPasAssezCATE].cate >= 2) {
            let cate = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqTropCATE && !a.verrouille && normaliserTexte(a.fonction) === 'CATE');
            let equ = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqPasAssezCATE && !a.verrouille && (normaliserTexte(a.fonction) === 'EQU' || normaliserTexte(a.fonction) === 'CEQU'));

            if (cate && equ) {
                propositionsEnAttente.push({
                    type: 'ECHANGE', a1: cate, a2: equ,
                    motif: `Échange pour équilibrer les CATE (${stats[eqTropCATE].cate} vs ${stats[eqPasAssezCATE].cate})`
                });
                cate.equipe = `Équipe ${eqPasAssezCATE}`; equ.equipe = `Équipe ${eqTropCATE}`;
            }
        }
    }

    // 3. Traitement dynamique pour CHAQUE SPÉCIALITÉ selon sa barre propre
    document.querySelectorAll(".input-poids-spec").forEach(input => {
        const poids = parseInt(input.value);
        if (poids === 0) return; // Si la barre est à 0, on ignore cette spécialité

        const specName = input.dataset.item;
        lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));

        let eqRich = lettresEquipes.reduce((a,b) => (stats[a].dicSpecs[specName]||0) > (stats[b].dicSpecs[specName]||0) ? a : b);
        let eqPauvre = lettresEquipes.reduce((a,b) => (stats[a].dicSpecs[specName]||0) < (stats[b].dicSpecs[specName]||0) ? a : b);

        if ((stats[eqRich].dicSpecs[specName]||0) - (stats[eqPauvre].dicSpecs[specName]||0) >= 2) {
            let specAgent = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqRich && !a.verrouille && extraireItems(a.specialites).includes(specName));
            let nonSpecAgent = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqPauvre && !a.verrouille && normaliserTexte(a.fonction) === normaliserTexte(specAgent?.fonction));

            if (specAgent && nonSpecAgent) {
                propositionsEnAttente.push({
                    type: 'ECHANGE', a1: specAgent, a2: nonSpecAgent,
                    motif: `Rééquilibrage de la spécialité [${specName}] (Pondération: ${poids}/5)`
                });
                specAgent.equipe = `Équipe ${eqPauvre}`; nonSpecAgent.equipe = `Équipe ${eqRich}`;
            }
        }
    });

    // 4. Traitement dynamique pour CHAQUE COMPÉTENCE selon sa barre propre
    document.querySelectorAll(".input-poids-comp").forEach(input => {
        const poids = parseInt(input.value);
        if (poids === 0) return; // Si la barre est à 0, on ignore cette compétence

        const compName = input.dataset.item;
        lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));

        let eqRich = lettresEquipes.reduce((a,b) => (stats[a].dicComps[compName]||0) > (stats[b].dicComps[compName]||0) ? a : b);
        let eqPauvre = lettresEquipes.reduce((a,b) => (stats[a].dicComps[compName]||0) < (stats[b].dicComps[compName]||0) ? a : b);

        if ((stats[eqRich].dicComps[compName]||0) - (stats[eqPauvre].dicComps[compName]||0) >= 2) {
            let compAgent = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqRich && !a.verrouille && extraireItems(a.competences).includes(compName));
            let nonCompAgent = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqPauvre && !a.verrouille && normaliserTexte(a.fonction) === normaliserTexte(compAgent?.fonction));

            if (compAgent && nonCompAgent) {
                propositionsEnAttente.push({
                    type: 'ECHANGE', a1: compAgent, a2: nonCompAgent,
                    motif: `Rééquilibrage de la compétence [${compName}] (Pondération: ${poids}/5)`
                });
                compAgent.equipe = `Équipe ${eqPauvre}`; nonCompAgent.equipe = `Équipe ${eqRich}`;
            }
        }
    });

    // 5. Départements
    if (pDept >= 1) {
        lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));
        let tousDepts = new Set();
        lettresEquipes.forEach(l => Object.keys(stats[l].dicDept).forEach(d => { if(d !== "ND") tousDepts.add(d); }));

        tousDepts.forEach(depName => {
            let eqRichDep = lettresEquipes.reduce((a,b) => (stats[a].dicDept[depName]||0) > (stats[b].dicDept[depName]||0) ? a : b);
            let eqPauvreDep = lettresEquipes.reduce((a,b) => (stats[a].dicDept[depName]||0) < (stats[b].dicDept[depName]||0) ? a : b);

            if ((stats[eqRichDep].dicDept[depName]||0) - (stats[eqPauvreDep].dicDept[depName]||0) >= 2) {
                let depAgent = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqRichDep && !a.verrouille && extraireDepartement(a) === depName);
                let autAgent = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqPauvreDep && !a.verrouille && extraireDepartement(a) !== depName && normaliserTexte(a.fonction) === normaliserTexte(depAgent?.fonction));

                if (depAgent && autAgent) {
                    propositionsEnAttente.push({
                        type: 'ECHANGE', a1: depAgent, a2: autAgent,
                        motif: `Rééquilibrage de la domiciliation (Dép. ${depName})`
                    });
                    depAgent.equipe = `Équipe ${eqPauvreDep}`; autAgent.equipe = `Équipe ${eqRichDep}`;
                }
            }
        });
    }

    // 6. Parité H/F
    if (pGenre >= 1) {
        lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));
        let eqMaxF = lettresEquipes.reduce((a,b) => stats[a].nbF > stats[b].nbF ? a : b);
        let eqMinF = lettresEquipes.reduce((a,b) => stats[a].nbF < stats[b].nbF ? a : b);

        if (stats[eqMaxF].nbF - stats[eqMinF].nbF >= 2) {
            let femme = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqMaxF && !a.verrouille && normaliserTexte(a.sexe).startsWith('F'));
            let homme = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqMinF && !a.verrouille && normaliserTexte(a.sexe).startsWith('M'));

            if (femme && homme && normaliserTexte(femme.fonction) === normaliserTexte(homme.fonction)) {
                propositionsEnAttente.push({
                    type: 'ECHANGE', a1: femme, a2: homme,
                    motif: `Permutation H/F pour la parité`
                });
            }
        }
    }

    afficherPropositions();
}

function afficherPropositions() {
    if (propositionsEnAttente.length === 0) {
        alert("✅ Aucun mouvement nécessaire selon les critères et pondérations actuels.");
        return;
    }
    const listeUI = document.getElementById("liste-propositions");
    listeUI.innerHTML = propositionsEnAttente.map(p => {
        if (p.type === 'TRANSFERT') {
            return `<li style="margin-bottom:10px;">➡️ Transférer <b>${p.a1.nom}</b> vers l'<b>Équipe ${p.eqCible}</b><br><span style="font-size:0.75rem; color:#94a3b8;">Motif: ${p.motif}</span></li>`;
        } else {
            return `<li style="margin-bottom:10px;">🔄 Échanger <b>${p.a1.nom}</b> (${extraireLettreEquipe(p.a1.equipe)}) <br>&nbsp;&nbsp;&nbsp;&nbsp;avec <b>${p.a2.nom}</b> (${extraireLettreEquipe(p.a2.equipe)})<br><span style="font-size:0.75rem; color:#94a3b8;">Motif: ${p.motif}</span></li>`;
        }
    }).join("");
    document.getElementById("modal-transferts").style.display = "flex";
}

function fermerModal() { document.getElementById("modal-transferts").style.display = "none"; }

function appliquerPropositions() {
    propositionsEnAttente.forEach(p => {
        if (p.type === 'TRANSFERT') {
            agentsLocaux.find(a => a.idUnique === p.a1.idUnique).equipe = `Équipe ${p.eqCible}`;
        } else if (p.type === 'ECHANGE') {
            const eq1 = p.a1.equipe;
            agentsLocaux.find(a => a.idUnique === p.a1.idUnique).equipe = p.a2.equipe;
            agentsLocaux.find(a => a.idUnique === p.a2.idUnique).equipe = eq1;
        }
    });
    
    const baseComplete = JSON.parse(localStorage.getItem("baseAgents") || "[]");
    agentsLocaux.forEach(modifie => {
        const idxBase = baseComplete.findIndex(a => a.matricule === modifie.matricule || (a.nom === modifie.nom && a.prenom === modifie.prenom));
        if (idxBase !== -1) baseComplete[idxBase].equipe = modifie.equipe;
    });
    localStorage.setItem("baseAgents", JSON.stringify(baseComplete));

    fermerModal();
    rendreEquipes();
}

function basculerVerrou(idUnique) {
    agentsLocaux.find(a => a.idUnique === idUnique).verrouille ^= true;
    rendreEquipes();
}

function deplacerAgent(idUnique, nouvelleEquipe) {
    if (!nouvelleEquipe) return;
    agentsLocaux.find(a => a.idUnique === idUnique).equipe = nouvelleEquipe;
    rendreEquipes();
}

// Synchronisation automatique en temps réel entre onglets/pages
window.addEventListener("storage", (event) => {
    if (event.key === "baseAgents") {
        const data = event.newValue;
        if (data) {
            // Recharger la variable locale et rafraîchir l'affichage
            agentsLocaux = JSON.parse(data).filter(a => {
                if (!a) return false;
                const eq = normaliserTexte(a.equipe);
                const fn = normaliserTexte(a.fonction);
                const st = normaliserTexte(a.statut);
                const estCadre = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'ADMINISTRATIF'].includes(fn) || eq.includes('ENCADREMENT');
                return st.includes('SPP') && !estCadre;
            });

            genererControlesDynamiques();
            rendreEquipes();
        }
    }
});
