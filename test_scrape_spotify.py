import httpx
import re

try:
    url = "https://open.spotify.com/track/4c077ef228b9451c9868e0d9b4b0e91a"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    print("Querying Spotify track page...")
    res = httpx.get(url, headers=headers, timeout=10)
    print("Status:", res.status_code)
    html = res.text
    
    title_match = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', html)
    if not title_match:
        title_match = re.search(r'<meta\s+name="twitter:title"\s+content="([^"]+)"', html)
        
    desc_match = re.search(r'<meta\s+property="og:description"\s+content="([^"]+)"', html)
    if not desc_match:
        desc_match = re.search(r'<meta\s+name="twitter:description"\s+content="([^"]+)"', html)
        
    print("Title Match:", title_match.group(1) if title_match else "None")
    print("Desc Match:", desc_match.group(1) if desc_match else "None")
except Exception as e:
    print("Error:", e)
