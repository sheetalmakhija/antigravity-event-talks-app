import re
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

cache = {
    "data": None,
    "last_updated": None
}

def parse_release_notes(xml_content):
    """
    Parses the BigQuery release notes Atom feed using xml.etree.ElementTree
    and BeautifulSoup to parse HTML content.
    """
    # Parse the XML
    root = ET.fromstring(xml_content)
    
    # Atom namespaces
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('atom:entry', ns)
    parsed_entries = []
    
    for entry in entries:
        # Get date
        title_el = entry.find('atom:title', ns)
        date_str = title_el.text.strip() if title_el is not None else "Unknown Date"
        
        # Get updated timestamp
        updated_el = entry.find('atom:updated', ns)
        updated_str = updated_el.text.strip() if updated_el is not None else ""
        
        # Get alternate link
        link = ""
        link_els = entry.findall('atom:link', ns)
        for l in link_els:
            if l.get('rel') == 'alternate':
                link = l.get('href', '')
                break
        if not link and link_els:
            link = link_els[0].get('href', '')
            
        # Get content
        content_el = entry.find('atom:content', ns)
        if content_el is None:
            continue
            
        content_html = content_el.text or ""
        content_soup = BeautifulSoup(content_html, "html.parser")
        
        # Find all h3 tags which mark update sections
        headers = content_soup.find_all("h3")
        updates = []
        
        if not headers:
            # If no h3 headers, treat the entire content as general
            plain_text = content_soup.get_text().strip()
            updates.append({
                "type": "General",
                "html": content_html,
                "text": plain_text
            })
        else:
            for h3 in headers:
                update_type = h3.text.strip()
                
                # Gather all elements between this h3 and the next h3
                sibling_html = []
                sibling = h3.next_sibling
                while sibling and sibling.name != "h3":
                    sibling_html.append(str(sibling))
                    sibling = sibling.next_sibling
                
                html_content = "".join(sibling_html).strip()
                temp_soup = BeautifulSoup(html_content, "html.parser")
                plain_text = temp_soup.get_text().strip()
                
                updates.append({
                    "type": update_type,
                    "html": html_content,
                    "text": plain_text
                })
        
        parsed_entries.append({
            "date": date_str,
            "updated": updated_str,
            "link": link,
            "updates": updates
        })
        
    return parsed_entries

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    
    if cache["data"] is not None and not force_refresh:
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_updated": cache["last_updated"],
            "data": cache["data"]
        })
        
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        parsed_data = parse_release_notes(response.content)
        
        import datetime
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        cache["data"] = parsed_data
        cache["last_updated"] = now_str
        
        return jsonify({
            "status": "success",
            "source": "live",
            "last_updated": now_str,
            "data": parsed_data
        })
    except Exception as e:
        if cache["data"] is not None:
            return jsonify({
                "status": "partial_error",
                "message": str(e),
                "source": "cache",
                "last_updated": cache["last_updated"],
                "data": cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
