const catalogueInitial = [
    {
        "id": "fmpa-emrs-18",
        "type": "Socle Commun",
        "fmpa": "EMRS",
        "activite": "EMRS",
        "libelle": "EMRS (18h)",
        "quota": 18,
        "sequence": "Engins, moyens et risques spécifiques du CIS",
        "profils": [
            "EQ / CE / CA / CATE"
        ],
        "dispenses": [
            "COD1",
            "COD6",
            "SUAP/PPABE",
            "SUAP"
        ],
        "modulations": [
            {
                "profil": "COD1",
                "quota": 14
            },
            {
                "profil": "COD6",
                "quota": 10
            },
            {
                "profil": "SUAP/PPABE",
                "quota": 6
            },
            {
                "profil": "SUAP",
                "quota": 6
            }
        ]
    },
    {
        "id": "fmpa-goc-1",
        "type": "Socle Commun",
        "fmpa": "GOC",
        "activite": "GOC",
        "libelle": "GOC 1",
        "quota": 1,
        "sequence": "Rappel sur les notions importantes (Feu éteint, surveillance...)",
        "profils": [
            "Tous profils"
        ]
    },
    {
        "id": "fmpa-inc-1",
        "type": "Socle Commun",
        "fmpa": "INCENDIE",
        "activite": "INCENDIE",
        "libelle": "INC 1",
        "quota": 2,
        "sequence": "Principe et règles d'alimentation",
        "profils": [
            "Tous profils"
        ],
        "dispenses": [
            "SUAP",
            "SUAP/PPABE"
        ]
    },
    {
        "id": "fmpa-inc-2",
        "type": "Socle Commun",
        "fmpa": "INCENDIE",
        "activite": "INCENDIE",
        "libelle": "INC 2",
        "quota": 2,
        "sequence": "Soutien à l'intervention : Toxicité des fumées, Amiante",
        "profils": [
            "Tous profils"
        ],
        "dispenses": [
            "SUAP",
            "SUAP/PPABE"
        ]
    },
    {
        "id": "fmpa-inc-3",
        "type": "Socle Commun",
        "fmpa": "INCENDIE",
        "activite": "INCENDIE",
        "libelle": "INC 3",
        "quota": 2,
        "sequence": "Techniques de lance",
        "profils": [
            "Tous profils"
        ],
        "dispenses": [
            "SUAP",
            "SUAP/PPABE"
        ]
    },
    {
        "id": "fmpa-inc-4",
        "type": "Socle Commun",
        "fmpa": "INCENDIE",
        "activite": "INCENDIE",
        "libelle": "INC 4",
        "quota": 2,
        "sequence": "Feux particuliers (VL transportant des matières dangereuses)",
        "profils": [
            "Tous profils"
        ],
        "dispenses": [
            "SUAP",
            "SUAP/PPABE"
        ]
    },
    {
        "id": "fmpa-nexsis-1",
        "type": "Socle Commun",
        "fmpa": "NEXSIS",
        "activite": "NEXSIS",
        "libelle": "Nexsis 1",
        "quota": 3,
        "sequence": "Formation des agents en CIS",
        "profils": [
            "Tous profils"
        ]
    },
    {
        "id": "fmpa-sic-1",
        "type": "Socle Commun",
        "fmpa": "SIC",
        "activite": "SIC",
        "libelle": "SIC 1",
        "quota": 1,
        "sequence": "Remontées d'informations opérationnelles (temporalité, contenu...)",
        "profils": [
            "Tous profils"
        ]
    },
    {
        "id": "fmpa-suap-1",
        "type": "Socle Commun",
        "fmpa": "SUAP",
        "activite": "SUAP",
        "libelle": "SUAP 1",
        "quota": 6,
        "sequence": "DGSCGC : Malaise et aggravation de maladie, Accompagnement à la mobilité",
        "profils": [
            "COD 1",
            "COD 6 MEA & BEA",
            "COD 6 MEA",
            "COD 6 BEA",
            "EQ / CE / CA / CATE",
            "Engagement Différencié"
        ],
        "modulations": []
    },
    {
        "id": "fmpa-suap-2",
        "type": "Socle Commun",
        "fmpa": "SUAP",
        "activite": "SUAP",
        "libelle": "SUAP 2",
        "quota": 2,
        "sequence": "Thématiques complémentaires : VIF, Traumatismes du dos et du cou",
        "profils": [
            "COD 1",
            "COD 6 MEA & BEA",
            "COD 6 MEA",
            "COD 6 BEA",
            "EQ / CE / CA / CATE",
            "Engagement Différencié"
        ]
    },
    {
        "id": "fmpa-trans-1",
        "type": "Socle Commun",
        "fmpa": "TRANSVERSALE",
        "activite": "TRANSVERSALE",
        "libelle": "Transverse",
        "quota": 1,
        "sequence": "Interventions en contexte menaçant",
        "profils": [
            "Tous profils",
            "Engagement Différencié"
        ]
    },
    {
        "id": "fmpa-cond-1",
        "type": "Spécialité",
        "fmpa": "Conduite",
        "activite": "CONDUITE",
        "libelle": "COD1",
        "quota": 4,
        "sequence": "Règles d'utilisation d'un engin pompe",
        "profils": [
            "COD 1",
            "COD 6 MEA & BEA",
            "COD 6 MEA",
            "COD 6 BEA"
        ],
        "dispenses": []
    },
    {
        "id": "fmpa-cond-2",
        "type": "Spécialité",
        "fmpa": "Conduite",
        "activite": "CONDUITE",
        "libelle": "COD6",
        "quota": 4,
        "sequence": "Règles d'utilisation d'un MEA",
        "profils": [
            "COD 1",
            "COD 6 MEA & BEA"
        ],
        "dispenses": []
    },
    {
        "id": "fmpa-fdf-1",
        "type": "Spécialité",
        "fmpa": "FDF",
        "activite": "IBNB",
        "libelle": "S1",
        "quota": 3,
        "sequence": "Techniques d'investigation et pose de lignes guide",
        "profils": [
            "FDF1"
        ],
        "modulations": []
    },
    {
        "id": "fmpa-fdf-2",
        "type": "Spécialité",
        "fmpa": "FDF",
        "activite": "IBNB",
        "libelle": "S2",
        "quota": 3,
        "sequence": "Techniques d’auto sauvetage et sauvetage de sauveteur",
        "profils": [
            "FDF2"
        ],
        "modulations": []
    },
    {
        "id": "fmpa-1787763657563",
        "type": "Spécialité",
        "activite": "IBNB",
        "libelle": "S3",
        "sequence": "Utilisation du BatFan / rideau stop fumées / brumisateur / GMHF",
        "quota": 3,
        "modulations": []
    },
    {
        "id": "fmpa-1787763680629",
        "type": "Spécialité",
        "activite": "IBNB",
        "libelle": "S4",
        "sequence": "Conception du navire et lecture de plan",
        "quota": 3,
        "modulations": []
    },
    {
        "id": "fmpa-1787763700428",
        "type": "Spécialité",
        "activite": "IBNB",
        "libelle": "S5",
        "sequence": "Lots projetables et utilisation des EPI mer et aéronautiques",
        "quota": 3,
        "modulations": []
    },
    {
        "id": "fmpa-1787763717928",
        "type": "Spécialité",
        "activite": "IBNB",
        "libelle": "S6",
        "sequence": "Mise en œuvre de la motopompe portative / SNSM",
        "quota": 3,
        "modulations": []
    },
    {
        "id": "fmpa-1787763749377",
        "type": "Spécialité",
        "activite": "IBNB",
        "libelle": "S7",
        "sequence": "Visite ou manœuvre en parking souterrain",
        "quota": 3,
        "modulations": []
    },
    {
        "id": "fmpa-1787763764944",
        "type": "Spécialité",
        "activite": "IBNB",
        "libelle": "S8",
        "sequence": "Visite ou manœuvre sur un navire",
        "quota": 3,
        "modulations": []
    },
    {
        "id": "fmpa-1787764382152",
        "type": "Spécialité",
        "activite": "RAD",
        "libelle": "S1",
        "sequence": "Dosimétrie opérationnelle",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764393134",
        "type": "Spécialité",
        "activite": "RAD",
        "libelle": "S2",
        "sequence": "Prise en charge d’une victime contaminée",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764403999",
        "type": "Spécialité",
        "activite": "RAD",
        "libelle": "S3",
        "sequence": "Accident de transport de colis radioactifs (Usage \nmédical)",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764417464",
        "type": "Spécialité",
        "activite": "RAD",
        "libelle": "S4",
        "sequence": "Etude d’un RETEX avec utilisation de la documentation",
        "quota": 4,
        "modulations": []
    },
    {
        "id": "fmpa-1787764428601",
        "type": "Spécialité",
        "activite": "RAD",
        "libelle": "S5",
        "sequence": "Matériel de détection",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764655080",
        "type": "Spécialité",
        "activite": "RAD",
        "libelle": "S6",
        "sequence": "Matériel de détection",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764176173",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S1",
        "sequence": "Parcours en tenue de type I",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764195472",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S2",
        "sequence": "Risques liés à l’oxygène",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764217536",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S3",
        "sequence": "Mélange de produits chimiques",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764248800",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S4",
        "sequence": "Feu de métaux",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764260728",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S5",
        "sequence": "MSP : Choix de tenues",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764269586",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S6",
        "sequence": "Mise en œuvre de la circulaire 750 et du DIP2",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764278634",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S7",
        "sequence": "Risques lié à l’hydrogène",
        "quota": 2,
        "modulations": []
    },
    {
        "id": "fmpa-1787764292485",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S8",
        "sequence": "Matériel de détection",
        "quota": 4,
        "modulations": []
    },
    {
        "id": "fmpa-1787764302377",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S9",
        "sequence": "Feu de silo avec visite de site",
        "quota": 4,
        "modulations": []
    },
    {
        "id": "fmpa-1787764312770",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S10",
        "sequence": "Mise en œuvre du matériels de colmatage / obturation",
        "quota": 4,
        "modulations": []
    },
    {
        "id": "fmpa-1787764230970",
        "type": "Spécialité",
        "activite": "RCH",
        "libelle": "S11",
        "sequence": "Connaissance des risques locaux (visite de site)",
        "quota": 4,
        "modulations": []
    }
];
