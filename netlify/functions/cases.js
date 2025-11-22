{
  "internistisch": [
    {
      "diagnosis": "Diabetische Ketoazidose (DKA)",
      "story": "19-jähriger Typ-1-Diabetiker, seit 2 Tagen zunehmend müde, stark durstig, Erbrechen, tiefe schnappende Atmung.",
      "key_findings": ["Kussmaul-Atmung", "BZ > 350 mg/dl", "Exsikkose", "Azetongeruch"],
      "red_flags": ["Bewusstlosigkeit droht", "schwere Azidose"],
      "target_outcome": "Schneller Transport, Monitoring, Flüssigkeit (NotSan)",
      "patient": { "name": "Max Mustermann", "age": 19, "sex": "m" },
      "anamnesis": {
        "SAMPLER": {
          "S": "Durst, häufiges Wasserlassen, Übelkeit, Erbrechen",
          "A": "keine",
          "M": "Insulin (vergessen gestern)",
          "P": "Typ-1-Diabetes seit 10 Jahren",
          "L": "vor 12 Std.",
          "E": "Insulin vergessen wegen Party",
          "R": "grippaler Infekt letzte Woche"
        }
      },
      "patho": { "tag": ["internistisch", "metabolisch"], "severity": 4 },
      "hidden": {
        "lung": "tiefe, schnelle Kussmaul-Atmung",
        "mouth": "stark trockene Schleimhäute, Azetongeruch",
        "abdomen": "weich, diffus druckschmerzhaft",
        "pain": { "location": "Bauch", "nrs": 7 }
      },
      "vitals_baseline": { "bpSys": 105, "bpDia": 65, "spo2": 96, "af": 28, "puls": 110, "bz": 420, "temp": 37.4, "gcs": 14, "jitter": 8 }
    },
    {
      "diagnosis": "Akute Hypoglykämie",
      "story": "72-jährige Diabetikerin, plötzlich verwirrt, schwitzt, zittert, kann kaum sprechen.",
      "key_findings": ["BZ < 50 mg/dl", "Schwitzen", "Zittern", "Verwirrtheit"],
      "red_flags": ["Krampfanfall möglich", "Hirnschaden bei Verzögerung"],
      "target_outcome": "Glukose sofort (NotSan), Monitoring",
      "patient": { "name": "Hilde K.", "age": 72, "sex": "w" },
      "anamnesis": { "SAMPLER": { "M": "Metformin + Insulin", "L": "Mittagessen ausgelassen" } },
      "hidden": { "pain": { "nrs": 0 } },
      "vitals_baseline": { "bpSys": 140, "bpDia": 80, "spo2": 98, "af": 18, "puls": 110, "bz": 38, "temp": 36.6, "gcs": 13, "jitter": 6 }
    },
    {
      "diagnosis": "Lungenembolie",
      "story": "48-jährige Frau nach Langstreckenflug, plötzlich Luftnot, stechende Thoraxschmerzen, Angst.",
      "key_findings": ["Tachypnoe", "Tachykardie", "SpO₂ ↓", "Schmerzen atemabhängig"],
      "red_flags": ["Kreislaufinstabilität", "Synkope"],
      "target_outcome": "O₂, Oberkörper hoch, schneller Transport",
      "patient": { "name": "Sandra L.", "age": 48, "sex": "w" },
      "hidden": { "lung": "rechts basal abgeschwächte Atemgeräusche" },
      "vitals_baseline": { "bpSys": 100, "bpDia": 65, "spo2": 88, "af": 32, "puls": 124, "bz": 110, "temp": 37.1, "gcs": 15, "jitter": 7 }
    }
  ],
  "neurologisch": [
    {
      "diagnosis": "Ischämischer Schlaganfall (MCA links)",
      "story": "66-jähriger Mann, plötzlich Sprachstörung und rechtsseitige Schwäche, vor 50 Minuten begonnen.",
      "key_findings": ["Aphasie", "Rechtshemiparese", "Facialisparese rechts", "BE-FAST positiv"],
      "red_flags": ["Zeitfenster < 4,5 h"],
      "target_outcome": "Stroke-Unit sofort, keine Blutdrucksenkung",
      "patient": { "name": "Werner G.", "age": 66, "sex": "m" },
      "hidden": {
        "befast": { "F": true, "A": true, "S": true },
        "lkw": "vor 50 Minuten",
        "pupillen": "isokor, prompt"
      },
      "vitals_baseline": { "bpSys": 190, "bpDia": 100, "spo2": 95, "af": 18, "puls": 82, "bz": 140, "temp": 36.8, "gcs": 12, "jitter": 10 }
    }
  ],
  "trauma": [
    {
      "diagnosis": "Polytrauma Motorradunfall",
      "story": "34-jähriger Motorradfahrer, Frontalaufprall, Helm abgeflogen, lag bewusstlos am Boden.",
      "key_findings": ["offene Oberschenkelfraktur links", "Beckenschmerz", "Thoraxprellung"],
      "red_flags": ["arterielle Blutung", "Schock", "HWS?"],
      "target_outcome": "Massive Blutung stoppen, Beckenschlinge, schneller Schockraum",
      "patient": { "name": "Tim R.", "age": 34, "sex": "m" },
      "hidden": {
        "injuries": [
          { "kind": "bleeding", "location": "Oberschenkel links", "type": "arterial" },
          { "kind": "fracture", "location": "Oberschenkel links", "open": true },
          { "kind": "pelvis", "instabil": true }
        ],
        "lung": "rechts abgeschwächte Atemgeräusche"
      },
      "vitals_baseline": { "bpSys": 85, "bpDia": 50, "spo2": 89, "af": 28, "puls": 130, "bz": 95, "temp": 35.9, "gcs": 9, "jitter": 12 }
    }
  ],
  "paediatrisch": [
    {
      "diagnosis": "Schwerer Asthmaanfall",
      "story": "7-jähriges Mädchen mit bekanntem Asthma, seit heute Nacht zunehmend pfeifende Atmung, spricht kaum noch Sätze.",
      "key_findings": ["Einziehungen", "Giemen", "SpO₂ 88%", "Tachykardie"],
      "red_flags": ["stille Lunge", "Zyanose", "Erschöpfung"],
      "target_outcome": "Sauerstoff, Salbutamol (falls SOP), Klinik",
      "patient": { "name": "Leonie S.", "age": 7, "sex": "w" },
      "hidden": { "lung": "diffuses exspiratorisches Giemen, prolongiertes Exspirium" },
      "vitals_baseline": { "bpSys": 105, "bpDia": 70, "spo2": 88, "af": 40, "puls": 150, "bz": 110, "temp": 37.6, "gcs": 15, "jitter": 6 }
    }
  ]
}