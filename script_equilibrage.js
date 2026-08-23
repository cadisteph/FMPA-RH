let agentsLocaux = [];
let propositionsEnAttente = [];

document.addEventListener("DOMContentLoaded", () => {
    const data = localStorage.getItem("baseAgents");
    if (!data) {
        alert("⚠️ Aucune donnée d'agent trouvée dans le navigateur.");
        return;
    }

    // Charger les agents SPP uniquement (hors encadrement)
    agentsLocaux = JSON.parse(data).filter(a => {
        const eq = (a.equipe || '').toUpperCase();
        const fn = (a.fonction || '').toUpperCase();
        const st = (a.statut || '').toUpperCase();
        
        // Exclut l'encadrement
        const estCadre = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'ADMINISTRATIF'].includes(fn) || eq.includes('ENCADREMENT');
        return st.includes('SPP') && !estCadre;
    });

    // Initialiser les verrous si non existants
    agentsLocaux.forEach(a => { if (a.verrouille === undefined) a.verrouille = false; });

    rendreEquipes();
});

// Calcule l'âge à partir de la date de naissance
function calculerAge(dateNaissance) {
    if (!dateNaissance) return 35; // Valeur par défaut si non renseignée
    const d = new Date(dateNaissance);
    if (isNaN(d.getTime())) return 35;
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

// Option 3.A : Rendu dynamique des équipes et recalcul des jauges
function rendreEquipes() {
    const equipes = ['A', 'B', 'C'];

    equipes.forEach(eqKey => {
        const nomEquipe = `EQUIPE ${eqKey}`;
        const membres = agentsLocaux.filter(a => (a.equipe || '').toUpperCase().trim() === nomEquipe || (a.equipe || '').toUpperCase().trim() === eqKey);
        
        // 1. Calcul des statistiques de l'équipe
        const total = membres.length;
        const nbFemmes = membres.filter(a => (a.sexe || '').toLowerCase().startsWith('f')).length;
        const pctFemmes = total > 0 ? Math.round((nbFemmes / total) * 100) : 0;
        
        const sommeAges = membres.reduce((sum, a) => sum + calculerAge(a.dateNaissance), 0);
        const moyAge = total > 0 ? Math.round(sommeAges / total) : 0;

        const nbCommandement = membres.filter(a => ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E'].includes((a.fonction || '').toUpperCase())).length;

        // 2. Rendu des jauges de stats
        document.getElementById(`count-${eqKey}`).innerText = total;
        document.getElementById(`stats-${eqKey}`).innerHTML = `
            <div class="jauge-row">
                <span>Âge Moyen : <b>${moyAge} ans</b></span>
            </div>
            <div class="jauge-row">
                <span>Parité F : <b>${pctFemmes}%</b></span>
                <div class="jauge-barre"><div class="jauge-fill" style="width: ${pctFemmes}%;"></div></div>
            </div>
            <div class="jauge-row">
                <span>Encadrement/CA : <b>${nbCommandement}</b></span>
            </div>
        `;

        // 3. Rendu de la liste des cartes agents
        const container = document.getElementById(`container-${eqKey}`);
        container.innerHTML = "";

        membres.forEach(agent => {
            const card = document.createElement("div");
            card.className = `carte-agent-simu ${agent.verrouille ? 'locked' : ''}`;
            
            card.innerHTML = `
                <div>
                    <div><strong>${(agent.nom || '').toUpperCase()}</strong> ${agent.prenom || ''}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${agent.grade || ''} | ${agent.fonction || 'Agent'} | ${calculerAge(agent.dateNaissance)} ans</div>
                </div>
                <div style="display:flex; align-items:center; gap: 8px;">
                    <label style="cursor:pointer;" title="Verrouiller dans cette équipe">
                        <input type="checkbox" ${agent.verrouille ? 'checked' : ''} onchange="basculerVerrou('${agent.matricule}')"> 🔒
                    </label>
                    <select class="select-equipe-deplacement" onchange="deplacerAgent('${agent.matricule}', this.value)">
                        <option value="">Déplacer...</option>
                        ${equipes.filter(e => e !== eqKey).map(e => `<option value="EQUIPE ${e}">Vers ${e}</option>`).join('')}
                    </select>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

// Option 3.A : Verrouiller / Déverrouiller un agent
function basculerVerrou(matricule) {
    const idx = agentsLocaux.findIndex(a => a.matricule === matricule);
    if (idx !== -1) {
        agentsLocaux[idx].verrouille = !agentsLocaux[idx].verrouille;
        rendreEquipes();
    }
}

// Option 3.A : Déplacement manuel immédiat d'un agent
function deplacerAgent(matricule, nouvelleEquipe) {
    if (!nouvelleEquipe) return;
    const idx = agentsLocaux.findIndex(a => a.matricule === matricule);
    if (idx !== -1) {
        agentsLocaux[idx].equipe = nouvelleEquipe;
        rendreEquipes();
    }
}

// Option 3.B : Moteur d'Optimisation Automatique
function sugererReequilibrage() {
    propositionsEnAttente = [];
    const mobileAgents = agentsLocaux.filter(a => !a.verrouille);

    if (mobileAgents.length === 0) {
        alert("Tous les agents sont verrouillés ! Déverrouillez-en quelques-uns pour permettre le rééquilibrage.");
        return;
    }

    // Exemple d'algorithme simple de rééquilibrage des effectifs globaux
    const compteurs = { 'EQUIPE A': 0, 'EQUIPE B': 0, 'EQUIPE C': 0 };
    agentsLocaux.forEach(a => {
        const eq = (a.equipe || '').toUpperCase().includes('A') ? 'EQUIPE A' : (a.equipe || '').toUpperCase().includes('B') ? 'EQUIPE B' : 'EQUIPE C';
        compteurs[eq]++;
    });

    // Identifie l'équipe la plus chargée et la moins chargée
    let minEq = 'EQUIPE A', maxEq = 'EQUIPE A';
    Object.keys(compteurs).forEach(eq => {
        if (compteurs[eq] < compteurs[minEq]) minEq = eq;
        if (compteurs[eq] > compteurs[maxEq]) maxEq = eq;
    });

    if (compteurs[maxEq] - compteurs[minEq] <= 1) {
        alert("Les équipes sont déjà parfaitement équilibrées en nombre !");
        return;
    }

    // Proposer le transfert d'un agent non-verrouillé de l'équipe surchargée vers la sous-chargée
    const candidat = mobileAgents.find(a => (a.equipe || '').toUpperCase().includes(maxEq.slice(-1)));

    if (candidat) {
        propositionsEnAttente.push({
            matricule: candidat.matricule,
            nom: `${candidat.nom} ${candidat.prenom}`,
            de: maxEq,
            vers: minEq
        });

        const listeUI = document.getElementById("liste-propositions");
        listeUI.innerHTML = propositionsEnAttente.map(p => `<li>Transfert de <b>${p.nom}</b> de l'<i>${p.de}</i> vers l'<i>${p.vers}</i></li>`).join("");
        document.getElementById("modal-transferts").style.display = "flex";
    }
}

function fermerModal() {
    document.getElementById("modal-transferts").style.display = "none";
}

function appliquerPropositions() {
    propositionsEnAttente.forEach(p => {
        const idx = agentsLocaux.findIndex(a => a.matricule === p.matricule);
        if (idx !== -1) agentsLocaux[idx].equipe = p.vers;
    });
    fermerModal();
    rendreEquipes();
}
