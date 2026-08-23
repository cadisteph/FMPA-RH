let agentsLocaux = [];
let propositionsEnAttente = [];

document.addEventListener("DOMContentLoaded", () => {
    const data = localStorage.getItem("baseAgents");
    if (!data) {
        alert("⚠️ Aucune donnée d'agent trouvée dans le navigateur.");
        return;
    }

    const tousLesAgents = JSON.parse(data);

    // Filtrage strict : Garde uniquement les SPP qui appartiennent aux équipes A, B ou C
    agentsLocaux = tousLesAgents.filter(a => {
        const eq = normaliserTexte(a.equipe);
        const fn = normaliserTexte(a.fonction);
        const st = normaliserTexte(a.statut);
        
        const estCadre = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'ADMINISTRATIF'].includes(fn) || eq.includes('ENCADREMENT');
        const estSPP = st.includes('SPP');

        return estSPP && !estCadre;
    });

    // Attribuer un identifiant unique si absent + état du verrou
    agentsLocaux.forEach((a, index) => {
        if (!a.idUnique) a.idUnique = a.matricule || `agent_${index}_${Date.now()}`;
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
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function rendreEquipes() {
    const lettresEquipes = ['A', 'B', 'C'];

    lettresEquipes.forEach(lettre => {
        const membres = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === lettre);
        
        // Statistiques
        const total = membres.length;
        const nbFemmes = membres.filter(a => normaliserTexte(a.sexe).startsWith('F') || normaliserTexte(a.genre).startsWith('F')).length;
        const pctFemmes = total > 0 ? Math.round((nbFemmes / total) * 100) : 0;
        
        const sommeAges = membres.reduce((sum, a) => sum + calculerAge(a.dateNaissance), 0);
        const moyAge = total > 0 ? Math.round(sommeAges / total) : 0;

        const nbCommandement = membres.filter(a => ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E'].includes(normaliserTexte(a.fonction))).length;

        // Rendu UI Stats
        document.getElementById(`count-${lettre}`).innerText = total;
        document.getElementById(`stats-${lettre}`).innerHTML = `
            <div class="jauge-row">
                <span>Moyenne d'âge : <b>${moyAge} ans</b></span>
            </div>
            <div class="jauge-row">
                <span>Parité F : <b>${pctFemmes}%</b> (${nbFemmes})</span>
                <div class="jauge-barre"><div class="jauge-fill" style="width: ${pctFemmes}%;"></div></div>
            </div>
            <div class="jauge-row">
                <span>Encadrement/CA : <b>${nbCommandement}</b></span>
            </div>
        `;

        // Rendu cartes agents
        const container = document.getElementById(`container-${lettre}`);
        container.innerHTML = "";

        if (membres.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#64748b; font-size:0.8rem; margin-top:20px;">Aucun agent affecté</div>`;
            return;
        }

        membres.forEach(agent => {
            const card = document.createElement("div");
            card.className = `carte-agent-simu ${agent.verrouille ? 'locked' : ''}`;
            
            card.innerHTML = `
                <div>
                    <div><strong>${(agent.nom || '').toUpperCase()}</strong> ${agent.prenom || ''}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${agent.grade || '-'} | ${agent.fonction || 'Agent'}</div>
                </div>
                <div style="display:flex; align-items:center; gap: 6px;">
                    <label style="cursor:pointer;" title="Verrouiller dans l'équipe">
                        <input type="checkbox" ${agent.verrouille ? 'checked' : ''} onchange="basculerVerrou('${agent.idUnique}')"> 🔒
                    </label>
                    <select class="select-equipe-deplacement" onchange="deplacerAgent('${agent.idUnique}', this.value)">
                        <option value="">Déplacer...</option>
                        ${lettresEquipes.filter(l => l !== lettre).map(l => `<option value="Équipe ${l}">Vers ${l}</option>`).join('')}
                    </select>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function basculerVerrou(idUnique) {
    const idx = agentsLocaux.findIndex(a => a.idUnique === idUnique);
    if (idx !== -1) {
        agentsLocaux[idx].verrouille = !agentsLocaux[idx].verrouille;
        rendreEquipes();
    }
}

function deplacerAgent(idUnique, nouvelleEquipe) {
    if (!nouvelleEquipe) return;
    const idx = agentsLocaux.findIndex(a => a.idUnique === idUnique);
    if (idx !== -1) {
        agentsLocaux[idx].equipe = nouvelleEquipe;
        rendreEquipes();
    }
}

// Algorithme de suggestion de rééquilibrage
function suggererReequilibrage() {
    propositionsEnAttente = [];
    const mobileAgents = agentsLocaux.filter(a => !a.verrouille);

    if (mobileAgents.length === 0) {
        alert("⚠️ Tous les agents sont verrouillés ! Déverrouillez-en quelques-uns pour autoriser des ajustements.");
        return;
    }

    // Calcul de la répartition actuelle
    const counts = { 'A': 0, 'B': 0, 'C': 0 };
    agentsLocaux.forEach(a => {
        const l = extraireLettreEquipe(a.equipe);
        if (l) counts[l]++;
    });

    let minL = 'A', maxL = 'A';
    Object.keys(counts).forEach(l => {
        if (counts[l] < counts[minL]) minL = l;
        if (counts[l] > counts[maxL]) maxL = l;
    });

    // Étape 1 : Équilibrage des effectifs bruts
    if (counts[maxL] - counts[minL] > 1) {
        const candidat = mobileAgents.find(a => extraireLettreEquipe(a.equipe) === maxL);
        if (candidat) {
            propositionsEnAttente.push({
                idUnique: candidat.idUnique,
                nom: `${candidat.nom.toUpperCase()} ${candidat.prenom}`,
                de: `Équipe ${maxL}`,
                vers: `Équipe ${minL}`
            });
        }
    }

    if (propositionsEnAttente.length === 0) {
        alert("✅ Vos équipes sont déjà équilibrées en effectifs !");
        return;
    }

    // Affichage des propositions dans la modal
    const listeUI = document.getElementById("liste-propositions");
    listeUI.innerHTML = propositionsEnAttente.map(p => `<li>Transfert de <b>${p.nom}</b> de l'<b>${p.de}</b> vers l'<b>${p.vers}</b></li>`).join("");
    document.getElementById("modal-transferts").style.display = "flex";
}

function fermerModal() {
    document.getElementById("modal-transferts").style.display = "none";
}

function appliquerPropositions() {
    propositionsEnAttente.forEach(p => {
        const idx = agentsLocaux.findIndex(a => a.idUnique === p.idUnique);
        if (idx !== -1) {
            agentsLocaux[idx].equipe = p.vers;
        }
    });
    
    // Sauvegarde immédiate des changements dans la base principale
    const baseComplete = JSON.parse(localStorage.getItem("baseAgents") || "[]");
    agentsLocaux.forEach(modifié => {
        const idxBase = baseComplete.findIndex(a => a.matricule === modifié.matricule || (a.nom === modifié.nom && a.prenom === modifié.prenom));
        if (idxBase !== -1) {
            baseComplete[idxBase].equipe = modifié.equipe;
        }
    });
    localStorage.setItem("baseAgents", JSON.stringify(baseComplete));

    fermerModal();
    rendreEquipes();
}
