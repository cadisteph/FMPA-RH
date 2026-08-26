let historiqueHistoriqueSaisies = [];
let agentsSelectionnes = new Set();

document.addEventListener("DOMContentLoaded", () => {
    // Date du jour par défaut
    document.getElementById("saisie-date").valueAsDate = new Date();

    initialiserFiltresEtListes();
    afficherTableauAgents();

    // Écouteurs de calcul de durée
    document.getElementById("saisie-heure-debut").addEventListener("change", calculerDuree);
    document.getElementById("saisie-heure-fin").addEventListener("change", calculerDuree);

    // Dynamic Select Activité -> Thème
    document.getElementById("saisie-activite").addEventListener("change", majListeThemes);

    // Sélection globale
    document.getElementById("select-all").addEventListener("change", basculerToutSelectionner);

    // Soumission du formulaire
    document.getElementById("form-saisie-groupee").addEventListener("submit", validerSaisieGroupee);
});

function initialiserFiltresEtListes() {
    // Remplir le selecteur d'activités depuis le catalogue
    const selectAct = document.getElementById("saisie-activite");
    const activites = [...new Set(catalogueInitial.map(item => item.activite))].sort();

    activites.forEach(act => {
        const opt = document.createElement("option");
        opt.value = act;
        opt.textContent = act;
        selectAct.appendChild(opt);
    });

    // Remplir la datalist des formateurs
    const datalistFormateurs = document.getElementById("liste-formateurs");
    tableauAgentsRH.forEach(agent => {
        const opt = document.createElement("option");
        opt.value = `${agent.nom} ${agent.prenom}`;
        datalistFormateurs.appendChild(opt);
    });
}

function majListeThemes() {
    const activite = document.getElementById("saisie-activite").value;
    const selectTheme = document.getElementById("saisie-theme");

    selectTheme.innerHTML = '<option value="">-- Choisir une formation --</option>';

    if (!activite) {
        selectTheme.disabled = true;
        return;
    }

    const formations = catalogueInitial.filter(f => f.activite === activite);
    formations.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = `${f.libelle} (${f.quota}h)`;
        selectTheme.appendChild(opt);
    });

    selectTheme.disabled = false;
}

function calculerDuree() {
    const debut = document.getElementById("saisie-heure-debut").value;
    const fin = document.getElementById("saisie-heure-fin").value;
    const display = document.getElementById("duree-calculee");

    if (!debut || !fin) {
        display.textContent = "0 h";
        return 0;
    }

    const [hD, mD] = debut.split(':').map(Number);
    const [hF, mF] = fin.split(':').map(Number);

    let minutesTotal = (hF * 60 + mF) - (hD * 60 + mD);
    if (minutesTotal < 0) minutesTotal += 24 * 60; // Gestion franchissement de minuit

    const heures = (minutesTotal / 60).toFixed(1);
    display.textContent = `${heures} h`;
    return parseFloat(heures);
}

function afficherTableauAgents() {
    const tbody = document.getElementById("tbody-agents");
    tbody.innerHTML = "";

    tableauAgentsRH.forEach(agent => {
        const idAgent = agent.id || agent.matricule;
        const isChecked = agentsSelectionnes.has(idAgent) ? "checked" : "";

        // Génération du texte d'avancement FMA Socle
        const avancementHtml = genererAvancementHtml(agent);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="checkbox" class="chk-agent" value="${idAgent}" ${isChecked} onchange="toggleAgent('${idAgent}')"></td>
            <td><strong>${agent.nom.toUpperCase()}</strong> ${agent.prenom} 📋</td>
            <td>${agent.equipe || 'Encadrement'}</td>
            <td>
                <span class="badge-tag badge-grade">${agent.grade || 'SPP'}</span>
                <span class="badge-tag badge-spv">${agent.profil || '-'}</span>
            </td>
            <td><small>${avancementHtml}</small></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("count-badge").textContent = `${tableauAgentsRH.length} / ${tableauAgentsRH.length} agent(s)`;
    majStatutSelection();
}

function genererAvancementHtml(agent) {
    // Exemple d'affichage calculé depuis le catalogue Socle Commun
    const socleFormations = catalogueInitial.filter(f => f.type === "Socle Commun");
    
    return socleFormations.map(f => {
        // En vrai, croiser avec les heures déjà réalisées par l'agent :
        const fait = 0; 
        const requis = f.quota;

        let styleClass = "fma-todo";
        if (fait >= requis) styleClass = "fma-done";
        else if (fait > 0) styleClass = "fma-partial";

        return `<span class="${styleClass}">${f.libelle}: ${fait}/${requis}h</span>`;
    }).join(" | ");
}

function toggleAgent(idAgent) {
    if (agentsSelectionnes.has(idAgent)) {
        agentsSelectionnes.delete(idAgent);
    } else {
        agentsSelectionnes.add(idAgent);
    }
    majStatutSelection();
}

function basculerToutSelectionner(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll(".chk-agent");

    agentsSelectionnes.clear();
    checkboxes.forEach(chk => {
        chk.checked = isChecked;
        if (isChecked) agentsSelectionnes.add(chk.value);
    });

    majStatutSelection();
}

function majStatutSelection() {
    const count = agentsSelectionnes.size;
    document.getElementById("selection-status").innerHTML = `👥 <strong>${count} agent(s) sélectionné(s)</strong> dans le tableau`;
    document.getElementById("btn-valider-groupe").disabled = count === 0;
}

function validerSaisieGroupee(e) {
    e.preventDefault();

    const duree = calculerDuree();
    const idFormation = document.getElementById("saisie-theme").value;
    const date = document.getElementById("saisie-date").value;
    const formateur = document.getElementById("saisie-formateur").value;

    if (agentsSelectionnes.size === 0) {
        alert("Veuillez sélectionner au moins un agent.");
        return;
    }

    if (!idFormation || duree <= 0) {
        alert("Veuillez choisir une formation et saisir des heures valides.");
        return;
    }

    // Enregistrement des données pour tous les agents cochés
    agentsSelectionnes.forEach(idAgent => {
        // Logique de mise à jour des heures de l'agent...
        console.log(`Ajout de ${duree}h pour l'agent ${idAgent} sur la formation ${idFormation} le ${date} (Formateur: ${formateur})`);
    });

    alert(`Saisie validée avec succès pour ${agentsSelectionnes.size} agent(s) !`);
    
    // Réinitialisation de la sélection
    agentsSelectionnes.clear();
    document.getElementById("select-all").checked = false;
    afficherTableauAgents();
}
