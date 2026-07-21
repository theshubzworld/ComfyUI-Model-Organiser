import os
import json

WORKFLOWS_DIR = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\workflows"

targets = ["yolox", "depth_anything", "sam2", "huggingface", "url", "download"]

found_info = []

for root, dirs, files in os.walk(WORKFLOWS_DIR):
    for file in files:
        if file.endswith(".json"):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    
                    # Check for our specific model filenames
                    for t in ["yolox", "depth_anything", "sam2"]:
                        if t in content.lower():
                            # Find nodes containing this
                            try:
                                data = json.loads(content)
                                nodes = data.get("nodes", [])
                                for node in nodes:
                                    node_str = json.dumps(node)
                                    if t in node_str.lower():
                                        found_info.append({
                                            "file": file,
                                            "path": filepath,
                                            "term": t,
                                            "nodeType": node.get("type"),
                                            "nodeTitle": node.get("title"),
                                            "widgets": node.get("widgets_values"),
                                            "properties": node.get("properties")
                                        })
                            except:
                                pass
            except Exception as e:
                pass

print(f"Found {len(found_info)} node occurrences:")
for item in found_info:
    print("=" * 60)
    print(f"Workflow File: {item['file']}")
    print(f"Term: {item['term']}")
    print(f"Node Type: {item['nodeType']}")
    print(f"Node Title: {item['nodeTitle']}")
    print(f"Widgets: {item['widgets']}")
    print(f"Properties: {item['properties']}")
