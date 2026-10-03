import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from services.root_cause import classify_root_causes

def test_root_cause_classification():
    sample_discrepancies = [
        {
            "id": "disc-1",
            "severity": "medium",
            "description": "Default learning rate in config is 0.001 instead of reported 0.0001.",
            "location": "configs/train.yaml:L14"
        },
        {
            "id": "disc-2",
            "severity": "low",
            "description": "Global random seed initialization is missing in entrypoint script.",
            "location": "src/main.py:L45"
        },
        {
            "id": "disc-3",
            "severity": "high",
            "description": "Custom train/val dataset split logic differs from paper benchmark description.",
            "location": "data/loader.py:L20"
        }
    ]

    classified = classify_root_causes(sample_discrepancies)
    print("Classified Discrepancies Result:")
    for item in classified:
        print(f"ID: {item['id']} | Root Cause: {item['root_cause']} | Explanation: {item['root_cause_explanation']}")
        assert "root_cause" in item
        assert item["root_cause"] in {
            "missing_hyperparameter",
            "dataset_split_difference",
            "dependency_version_drift",
            "seed_variance",
            "undocumented_default",
            "insufficient_evidence"
        }
    print("Backend Root Cause Classification Test PASSED!")

if __name__ == "__main__":
    test_root_cause_classification()
