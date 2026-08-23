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

// DÉFINITION STRICTE DES HIÉRARCHIES (Identique à l'organigramme)
const ORDRE_FONCTIONS = [
    'CDC', 'ACDC', 'OFPAO', 'OFTECH', 'SOFPAO', 'SOFTECH', 
    'ASSISTANTE', 'SECRETARIAT', 'ADMINISTRATIF',
    'CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEQU', 'EQU'
];

const ORDRE_GRADES = [
    'CDT', 'CNE', 'LTN', 'ADC', 'ADJ', 'SCH', 'SGT', 'CCH', 'CPL', 'SAP'
];

// Algorithme de tri hiérarchique
function trierAgentsHierarchie(a, b) {
    const fA = normaliserTexte(a.fonction);
    const fB = normaliserTexte(b.fonction);

    let idxFA = ORDRE_FONCTIONS.indexOf(fA);
    let idxFB = ORDRE_FONCTIONS.indexOf(fB);
    if (idxFA === -1) idxFA = 999;
    if (idxFB === -1) idxFB = 999;

    if (idxFA !== idxFB) return idxFA - idxFB;

    // Égalité de fonction -> Tri par Grade
    const gA = normaliserTexte(a.grade);
    const gB = normaliserTexte(b.grade);

    let idxGA = ORDRE_GRADES.indexOf(gA);
    let idxGB = ORDRE_GRADES.indexOf(gB);
    if (idxGA === -1) idxGA = 999;
    if (idxGB === -1) idxGB = 999;

    if (idxGA !== idxGB) return idxGA - idxGB;

    // Égalité de grade -> Ordre alphabétique Nom puis Prénom
    const nomA = normaliserTexte(a.nom);
    const nomB = normaliserTexte(b.nom);
    if (nomA !== nomB) return nomA.localeCompare(nomB);

    return normaliserTexte(a.prenom).localeCompare(normaliserTexte(b.prenom));
}

function rendreEquipes() {
    const lettresEquipes = ['A', 'B', 'C'];

    lettresEquipes.forEach(lettre => {
        let membres = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === lettre);
        
        // TRI HIÉRARCHIQUE DES AGENTS
        membres.sort(trierAgentsHierarchie);

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
// Algorithme de rééquilibrage multi-critères prenant en compte les curseurs
function suggererReequilibrage() {
    propositionsEnAttente = [];
    const mobileAgents = agentsLocaux.filter(a => !a.verrouille);

    if (mobileAgents.length === 0) {
        alert("⚠️ Tous les agents sont verrouillés ! Déverrouillez-en quelques-uns pour autoriser des ajustements.");
        return;
    }

    // 1. DÉCORTIQUER LES POIDS DES CURSEURS (de 1 à 5)
    const pCmd = parseInt(document.getElementById("poids-cmd")?.value || 5);
    const pSpec = parseInt(document.getElementById("poids-spec")?.value || 4);
    const pAge = parseInt(document.getElementById("poids-age")?.value || 3);
    const pGenre = parseInt(document.getElementById("poids-genre")?.value || 2);

    const lettresEquipes = ['A', 'B', 'C'];

    // Fonction interne pour évaluer le "Score de besoin" d'une équipe
    // Plus le score est BAS, plus l'équipe a BESOIN de renfort sur les critères prioritaires
    function calculerMetriquesEquipes() {
        const stats = {};
        
        lettresEquipes.forEach(lettre => {
            const membres = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === lettre);
            const total = membres.length;
            const nbFemmes = membres.filter(a => normaliserTexte(a.sexe).startsWith('F') || normaliserTexte(a.genre).startsWith('F')).length;
            const sommeAges = membres.reduce((sum, a) => sum + calculerAge(a.dateNaissance), 0);
            const moyAge = total > 0 ? (sommeAges / total) : 35;
            const nbCmd = membres.filter(a => ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E'].includes(normaliserTexte(a.fonction))).length;
            
            // Compte arbitraire des spécialistes (ex: COD, RAD, RCH, SAV)
            const nbSpec = membres.filter(a => {
                const spec = normaliserTexte(a.specialites || "") + normaliserTexte(a.competences || "");
                return spec.includes('COD') || spec.includes('RAD') || spec.includes('RCH') || spec.includes('SAV');
            }).length;

            stats[lettre] = { total, nbFemmes, moyAge, nbCmd, nbSpec };
        });

        return stats;
    }

    let stats = calculerMetriquesEquipes();

    // 2. ÉVALUATION DU PUS FORT DÉSÉQUILIBRE

    // A. Analyse par Effectif brut / Commandement (Poids pCmd)
    let minCmd = 'A', maxCmd = 'A';
    let minEff = 'A', maxEff = 'A';
    
    lettresEquipes.forEach(l => {
        if (stats[l].total < stats[minEff].total) minEff = l;
        if (stats[l].total > stats[maxEff].total) maxEff = l;
        if (stats[l].nbCmd < stats[minCmd].nbCmd) minCmd = l;
        if (stats[l].nbCmd > stats[maxCmd].nbCmd) maxCmd = l;
    });

    // B. Analyse par Parité Homme/Femme (Poids pGenre)
    let minFemmes = 'A', maxFemmes = 'A';
    lettresEquipes.forEach(l => {
        if (stats[l].nbFemmes < stats[minFemmes].nbFemmes) minFemmes = l;
        if (stats[l].nbFemmes > stats[maxFemmes].nbFemmes) maxFemmes = l;
    });

    // C. Analyse par Spécialités (Poids pSpec)
    let minSpec = 'A', maxSpec = 'A';
    lettresEquipes.forEach(l => {
        if (stats[l].nbSpec < stats[minSpec].nbSpec) minSpec = l;
        if (stats[l].nbSpec > stats[maxSpec].nbSpec) maxSpec = l;
    });

    // D. Analyse par Pyramide des Âges (Poids pAge)
    let minAge = 'A', maxAge = 'A';
    lettresEquipes.forEach(l => {
        if (stats[l].moyAge < stats[minAge].moyAge) minAge = l;
        if (stats[l].moyAge > stats[maxAge].moyAge) maxAge = l;
    });

    // 3. SELECTION DE LA PROPOSITION SELON LA PRIORITÉ LA PLUS HAUTE

    // Priorité 1 : Effectif brut (Si écart > 1 agent)
    if (stats[maxEff].total - stats[minEff].total > 1) {
        const candidat = mobileAgents.find(a => extraireLettreEquipe(a.equipe) === maxEff);
        if (candidat) {
            propositionsEnAttente.push({
                idUnique: candidat.idUnique,
                nom: `${candidat.nom.toUpperCase()} ${candidat.prenom}`,
                de: `Équipe ${maxEff}`,
                vers: `Équipe ${minEff}`,
                raison: `Équilibrage de l'effectif global (Poids : ${pCmd}/5)`
            });
        }
    } 
    // Priorité 2 : Commandement (Si le curseur Commandement est haut >= 3 et écart de chefs)
    else if (pCmd >= 3 && (stats[maxCmd].nbCmd - stats[minCmd].nbCmd > 1)) {
        const candidat = mobileAgents.find(a => 
            extraireLettreEquipe(a.equipe) === maxCmd && 
            ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E'].includes(normaliserTexte(a.fonction))
        );
        if (candidat) {
            propositionsEnAttente.push({
                idUnique: candidat.idUnique,
                nom: `${candidat.nom.toUpperCase()} ${candidat.prenom}`,
                de: `Équipe ${maxCmd}`,
                vers: `Équipe ${minCmd}`,
                raison: `Répartition du commandement/chefs d'agrès (${stats[maxCmd].nbCmd} vs ${stats[minCmd].nbCmd})`
            });
        }
    }
    // Priorité 3 : Spécialités (Si le curseur Spécialités est haut >= 3)
    else if (pSpec >= 3 && (stats[maxSpec].nbSpec - stats[minSpec].nbSpec > 1)) {
        const candidat = mobileAgents.find(a => {
            const spec = normaliserTexte(a.specialites || "") + normaliserTexte(a.competences || "");
            return extraireLettreEquipe(a.equipe) === maxSpec && (spec.includes('COD') || spec.includes('RAD') || spec.includes('RCH'));
        });
        if (candidat) {
            propositionsEnAttente.push({
                idUnique: candidat.idUnique,
                nom: `${candidat.nom.toUpperCase()} ${candidat.prenom}`,
                de: `Équipe ${maxSpec}`,
                vers: `Équipe ${minSpec}`,
                raison: `Rééquilibrage des spécialités opérationnelles (Poids : ${pSpec}/5)`
            });
        }
    }
    // Priorité 4 : Parité (Si le curseur Genre est haut >= 3)
    else if (pGenre >= 3 && (stats[maxFemmes].nbFemmes - stats[minFemmes].nbFemmes > 1)) {
        const candidat = mobileAgents.find(a => 
            extraireLettreEquipe(a.equipe) === maxFemmes && 
            (normaliserTexte(a.sexe).startsWith('F') || normaliserTexte(a.genre).startsWith('F'))
        );
        if (candidat) {
            propositionsEnAttente.push({
                idUnique: candidat.idUnique,
                nom: `${candidat.nom.toUpperCase()} ${candidat.prenom}`,
                de: `Équipe ${maxFemmes}`,
                vers: `Équipe ${minFemmes}`,
                raison: `Amélioration de la parité hommes/femmes (Poids : ${pGenre}/5)`
            });
        }
    }
    // Priorité 5 : Pyramide des âges (Si écart moyen > 3 ans et curseur Âge haut)
    else if (pAge >= 3 && (stats[maxAge].moyAge - stats[minAge].moyAge > 3)) {
        // Déplacer un agent jeune de l'équipe jeune vers l'équipe âgée
        const candidat = mobileAgents.find(a => 
            extraireLettreEquipe(a.equipe) === minAge && 
            calculerAge(a.dateNaissance) < 30
        );
        if (candidat) {
            propositionsEnAttente.push({
                idUnique: candidat.idUnique,
                nom: `${candidat.nom.toUpperCase()} ${candidat.prenom}`,
                de: `Équipe ${minAge}`,
                vers: `Équipe ${maxAge}`,
                raison: `Harmonisation des moyennes d'âge (Écart : ${Math.round(stats[maxAge].moyAge - stats[minAge].moyAge)} ans)`
            });
        }
    }

    // 4. AFFICHAGE DES RÉSULTATS DANS LA MODALE
    if (propositionsEnAttente.length === 0) {
        alert("✅ Au vu des priorités sélectionnées, aucun rééquilibrage n'est nécessaire !");
        return;
    }

    const listeUI = document.getElementById("liste-propositions");
    listeUI.innerHTML = propositionsEnAttente.map(p => `
        <li style="margin-bottom:8px;">
            Transfert de <b>${p.nom}</b> de l'<b>${p.de}</b> vers l'<b>${p.vers}</b><br>
            <span style="font-size:0.75rem; color:#94a3b8;">Motif : ${p.raison}</span>
        </li>
    `).join("");
    
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
