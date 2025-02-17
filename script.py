import os
import json
import requests

DATA_FILE = 'data/data1.0.json'
IMG_DIR = 'img'
BASE_URL = "https://www.satisfactorytools.com/assets/images/items/"

def ensure_img_dir():
    if not os.path.exists(IMG_DIR):
        os.makedirs(IMG_DIR)

def load_items():
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
    # Assuming data contains "items" as a dict of item objects
    return data.get('items', {})

def download_image(icon):
    filename = f"{icon}_64.png"
    url = f"{BASE_URL}{filename}"
    out_path = os.path.join(IMG_DIR, filename)

    # Skip download if file already exists
    if os.path.exists(out_path):
        print(f"Exists: {out_path}")
        return

    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            with open(out_path, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded: {filename}")
        else:
            print(f"Failed ({response.status_code}): {filename}")
    except Exception as e:
        print(f"Error downloading {filename}: {e}")

def main():
    ensure_img_dir()
    items = load_items()
    print(f"Found {len(items)} items to process.")
    for item in items.values():
        icon = item.get('icon')
        if icon:
            download_image(icon)
        else:
            print("No icon found for an item, skipping.")

if __name__ == '__main__':
    main()