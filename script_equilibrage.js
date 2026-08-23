let agentsLocaux = [];
let propositionsEnAttente = [];

const ORDRE_FONCTIONS = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'SOFPAO', 'SOFTECH', 'ASSISTANTE', 'SECRETARIAT', 'ADMINISTRATIF', 'CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEQU', 'EQU'];
const ORDRE_GRADES = ['CDT', 'CNE', 'LTN', 'ADC', 'ADJ', 'SCH', 'SGT', 'CCH', 'CPL', 'SAP'];

document.addEventListener("DOMContentLoaded", () => {
    const data = localStorage.getItem("baseAgents");
    if (!data) return;

    agentsLocaux = JSON.parse(data).filter(a => {
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

    rendreEquipes();
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

// TRI EXACTEMENT COMME L'ORGANIGRAMME
function trierAgentsHierarchie(a, b) {
    const fA = normaliserTexte(a.fonction);
    const fB = normaliserTexte(b.fonction);
    let idxFA = ORDRE_FONCTIONS.indexOf(fA); let idxFB = ORDRE_FONCTIONS.indexOf(fB);
    if (idxFA === -1) idxFA = 999; if (idxFB === -1) idxFB = 999;
    if (idxFA !== idxFB) return idxFA - idxFB;

    const gA = normaliserTexte(a.grade); const gB = normaliserTexte(b.grade);
    let idxGA = ORDRE_GRADES.indexOf(gA); let idxGB = ORDRE_GRADES.indexOf(gB);
    if (idxGA === -1) idxGA = 999; if (idxGB === -1) idxGB = 999;
    if (idxGA !== idxGB) return idxGA - idxGB;

    const nomA = normaliserTexte(a.nom); const nomB = normaliserTexte(b.nom);
    if (nomA !== nomB) return nomA.localeCompare(nomB);
    return normaliserTexte(a.prenom).localeCompare(normaliserTexte(b.prenom));
}

function calculerStatsEquipe(membres) {
    const nb = membres.length;
    const nbF = membres.filter(a => normaliserTexte(a.sexe).startsWith('F') || normaliserTexte(a.genre).startsWith('F')).length;
    const ageMoy = nb > 0 ? Math.round(membres.reduce((s, a) => s + calculerAge(a.dateNaissance), 0) / nb) : 0;
    
    // Fonctions
    const compteFn = (fn) => membres.filter(a => normaliserTexte(a.fonction) === fn).length;
    
    // Spécialités & Compétences (Cumul simple pour l'affichage condensé)
    let totalSpec = 0, totalComp = 0;
    membres.forEach(a => {
        if (a.specialites && a.specialites.trim() !== "") totalSpec += a.specialites.split(',').length;
        if (a.competences && a.competences.trim() !== "") totalComp += a.competences.split(',').length;
    });

    return { 
        nb, nbF, pctF: nb > 0 ? Math.round((nbF/nb)*100) : 0, ageMoy,
        cate: compteFn('CATE'), ca1e: compteFn('CA1E'),
        cequ: compteFn('CEQU'), equ: compteFn('EQU'),
        cdg: compteFn('CDG') + compteFn('ACDG1') + compteFn('ACDG2'),
        totalSpec, totalComp
    };
}

function rendreEquipes() {
    const lettresEquipes = ['A', 'B', 'C'];

    lettresEquipes.forEach(lettre => {
        const membres = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === lettre);
        membres.sort(trierAgentsHierarchie);

        const s = calculerStatsEquipe(membres);
        
        // AFFICHAGE CONDENSÉ DES STATS
        document.getElementById(`count-${lettre}`).innerText = s.nb;
        document.getElementById(`stats-${lettre}`).innerHTML = `
            <div class="stat-badge full-width"><span class="stat-label">Agents:</span> <span class="stat-value">${s.nb}</span></div>
            <div class="stat-badge"><span class="stat-label">Femmes:</span> <span class="stat-value">${s.nbF} (${s.pctF}%)</span></div>
            <div class="stat-badge"><span class="stat-label">Âge moy:</span> <span class="stat-value">${s.ageMoy} ans</span></div>
            <div class="stat-badge"><span class="stat-label">CDG/ACDG:</span> <span class="stat-value">${s.cdg}</span></div>
            <div class="stat-badge"><span class="stat-label">CATE:</span> <span class="stat-value">${s.cate}</span></div>
            <div class="stat-badge"><span class="stat-label">CA1E:</span> <span class="stat-value">${s.ca1e}</span></div>
            <div class="stat-badge"><span class="stat-label">CEQU:</span> <span class="stat-value">${s.cequ}</span></div>
            <div class="stat-badge"><span class="stat-label">EQU:</span> <span class="stat-value">${s.equ}</span></div>
            <div class="stat-badge"><span class="stat-label">Total Spéc:</span> <span class="stat-value" style="color:#60a5fa">${s.totalSpec}</span></div>
            <div class="stat-badge"><span class="stat-label">Total Comp:</span> <span class="stat-value" style="color:#34d399">${s.totalComp}</span></div>
        `;

        // AFFICHAGE DES AGENTS
        const container = document.getElementById(`container-${lettre}`);
        container.innerHTML = "";
        membres.forEach(agent => {
            const specs = agent.specialites ? `<span class="agent-spec">[${agent.specialites}]</span>` : '';
            container.innerHTML += `
                <div class="carte-agent-simu ${agent.verrouille ? 'locked' : ''}">
                    <div class="agent-info-compact">
                        <span class="agent-nom">${(agent.nom || '').toUpperCase()} ${agent.prenom || ''}</span>
                        <div class="agent-details">
                            <span>${agent.fonction || 'Agent'}</span>
                            <span>${agent.grade || '-'}</span>
                            ${specs}
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <input type="checkbox" title="Verrouiller" ${agent.verrouille ? 'checked' : ''} onchange="basculerVerrou('${agent.idUnique}')">
                        <select class="select-equipe-deplacement" onchange="deplacerAgent('${agent.idUnique}', this.value)">
                            <option value="">Déplacer...</option>
                            ${lettresEquipes.filter(l => l !== lettre).map(l => `<option value="Équipe ${l}">Vers ${l}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
        });
    });
}

// === ALGORITHME FIN : PERMUTATIONS CROISÉES MULTIPLES ===
function suggererReequilibrage() {
    propositionsEnAttente = [];
    let tempAgents = JSON.parse(JSON.stringify(agentsLocaux)); // Copie de travail
    const lettresEquipes = ['A', 'B', 'C'];

    // 1. Lire les poids
    const pCmd = parseInt(document.getElementById("poids-cmd")?.value || 5);
    const pGenre = parseInt(document.getElementById("poids-genre")?.value || 2);
    // (Tu pourras ajouter pSpec et pAge dans les conditions suivantes)

    // 2. Équilibrer l'effectif global (Transfert simple)
    let stats = {};
    lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));
    
    let equipesTriees = [...lettresEquipes].sort((a,b) => stats[b].nb - stats[a].nb);
    let eqMax = equipesTriees[0];
    let eqMin = equipesTriees[2];

    if (stats[eqMax].nb - stats[eqMin].nb >= 2) {
        let candidat = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqMax && !a.verrouille && normaliserTexte(a.fonction) === 'EQU');
        if (candidat) {
            propositionsEnAttente.push({ 
                type: 'TRANSFERT', a1: candidat, eqCible: eqMin, 
                motif: `Rééquilibrage de l'effectif global (+1 agent)` 
            });
            candidat.equipe = `Équipe ${eqMin}`; // Simuler le déplacement
        }
    }

    // 3. Équilibrer les CATE / CA1E sans casser l'effectif global (Permutation)
    if (pCmd >= 3) {
        lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));
        let eqTropCATE = lettresEquipes.reduce((a,b) => stats[a].cate > stats[b].cate ? a : b);
        let eqPasAssezCATE = lettresEquipes.reduce((a,b) => stats[a].cate < stats[b].cate ? a : b);

        if (stats[eqTropCATE].cate - stats[eqPasAssezCATE].cate >= 2) {
            // Trouver un CATE dans l'équipe riche
            let cate = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqTropCATE && !a.verrouille && normaliserTexte(a.fonction) === 'CATE');
            // Trouver un EQU ou CEQU dans l'équipe pauvre pour faire l'échange
            let equ = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqPasAssezCATE && !a.verrouille && (normaliserTexte(a.fonction) === 'EQU' || normaliserTexte(a.fonction) === 'CEQU'));

            if (cate && equ) {
                propositionsEnAttente.push({
                    type: 'ECHANGE', a1: cate, a2: equ,
                    motif: `Échange pour équilibrer le nombre de CATE (${stats[eqTropCATE].cate} vs ${stats[eqPasAssezCATE].cate})`
                });
                cate.equipe = `Équipe ${eqPasAssezCATE}`; equ.equipe = `Équipe ${eqTropCATE}`;
            }
        }
    }

    // 4. Équilibrer les Femmes sans casser l'effectif global (Permutation)
    if (pGenre >= 3) {
        lettresEquipes.forEach(l => stats[l] = calculerStatsEquipe(tempAgents.filter(a => extraireLettreEquipe(a.equipe) === l)));
        let eqMaxF = lettresEquipes.reduce((a,b) => stats[a].nbF > stats[b].nbF ? a : b);
        let eqMinF = lettresEquipes.reduce((a,b) => stats[a].nbF < stats[b].nbF ? a : b);

        if (stats[eqMaxF].nbF - stats[eqMinF].nbF >= 2) {
            let femme = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqMaxF && !a.verrouille && normaliserTexte(a.sexe).startsWith('F'));
            let homme = tempAgents.find(a => extraireLettreEquipe(a.equipe) === eqMinF && !a.verrouille && normaliserTexte(a.sexe).startsWith('M'));

            if (femme && homme && normaliserTexte(femme.fonction) === normaliserTexte(homme.fonction)) {
                propositionsEnAttente.push({
                    type: 'ECHANGE', a1: femme, a2: homme,
                    motif: `Permutation H/F à fonction égale pour l'équilibre de parité.`
                });
            }
        }
    }

    afficherPropositions();
}

function afficherPropositions() {
    if (propositionsEnAttente.length === 0) {
        alert("✅ Aucun mouvement nécessaire selon les critères actuels.");
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
    agentsLocaux.forEach(modifié => {
        const idxBase = baseComplete.findIndex(a => a.matricule === modifié.matricule || (a.nom === modifié.nom && a.prenom === modifié.prenom));
        if (idxBase !== -1) baseComplete[idxBase].equipe = modifié.equipe;
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
