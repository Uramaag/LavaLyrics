import httpx

try:
    url = "https://open.spotify.com/oembed?url=https://open.spotify.com/track/4c077ef228b9451c9868e0d9b4b0e91a"
    print("Querying oembed:", url)
    res = httpx.get(url, timeout=10)
    print("Status:", res.status_code)
    if res.status_code == 200:
        print("Data:", res.json())
except Exception as e:
    print("Error:", e)
