#!/usr/bin/env python3
"""Readable primary-source text, contextual media and VideoObject metadata; no JS execution."""
import json, sys, re
from html.parser import HTMLParser
from urllib.parse import urljoin

class Extractor(HTMLParser):
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base, self.skip, self.in_title = base, 0, False
        self.text, self.title, self.media, self.links, self.structured = [], [], [], [], []
        self.ld = None
        self.heading = ''
        self.in_heading = False
    def add(self, url, tag, alt='', mime=''):
        if url: self.media.append({'url': urljoin(self.base,url), 'tag':tag, 'alt':alt, 'type':mime, 'context':self.heading})
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('type') == 'application/ld+json': self.ld = []
        if tag in ('script','style','noscript','svg'): self.skip += 1
        if tag == 'title': self.in_title = True
        if self.skip: return
        if tag in ('h1','h2','h3'): self.in_heading = True; self.heading = ''
        if tag == 'a' and attrs.get('href'): self.links.append(urljoin(self.base,attrs['href']))
        if tag in ('img','video','source','iframe'):
            for key in ('src','data-src','data-lazy-src'):
                if attrs.get(key): self.add(attrs[key],tag,attrs.get('alt') or attrs.get('title',''),attrs.get('type',''))
            if tag in ('img','source'):
                for part in attrs.get('srcset','').split(','):
                    if part.strip(): self.add(part.strip().split()[0],tag,attrs.get('alt',''),attrs.get('type',''))
        if tag=='meta' and attrs.get('property') in ('og:image','og:video','og:video:url','og:video:secure_url'): self.add(attrs.get('content'),'meta')
        if tag=='video': self.add(attrs.get('poster'),'poster',mime='image')
    def handle_endtag(self, tag):
        if tag=='script' and self.ld is not None:
            try: self.structured.append(json.loads(''.join(self.ld)))
            except (ValueError,TypeError): pass
            self.ld=None
        if tag in ('script','style','noscript','svg') and self.skip: self.skip-=1
        if tag=='title': self.in_title=False
        if tag in ('h1','h2','h3'): self.in_heading=False
    def handle_data(self,text):
        if self.ld is not None: self.ld.append(text)
        if self.skip:return
        text=' '.join(text.split())
        if text:
            self.text.append(text)
            if self.in_title:self.title.append(text)
            if self.in_heading:self.heading+=text
    def video_objects(self,value):
        if isinstance(value,list):
            for item in value:self.video_objects(item)
        elif isinstance(value,dict):
            if 'VideoObject' in ([value.get('@type')] if isinstance(value.get('@type'),str) else (value.get('@type') or [])):
                for key in ('contentUrl','embedUrl','thumbnailUrl'):
                    urls=value.get(key,[])
                    for url in ([urls] if isinstance(urls,str) else urls):
                        if isinstance(url,str):self.add(url,'video-object-'+key,value.get('name',''),'video' if key!='thumbnailUrl' else 'image')
            for v in value.values():
                if isinstance(v,(dict,list)):self.video_objects(v)

p=Extractor(sys.argv[1]);p.feed(sys.stdin.read())
for link in p.links:
    if re.search(r'\.(mp4|webm|m3u8|png|jpe?g|webp)(?:\?|$)',link,re.I):p.add(link,'linked-media')
    elif re.search(r'https?://(?:www\.)?(?:youtube\.com/watch|youtu\.be/|vimeo\.com/)',link,re.I):p.add(link,'linked-player')
for item in p.structured:p.video_objects(item)
for match in re.finditer(r'https?://[^\s<>"\x27]+\.(?:mp4|webm)(?:\?[^\s<>"\x27]*)?', '\n'.join(p.text),re.I):p.add(match.group(),'documented-example','Referenced in source text; review context')
print(json.dumps({'title':' '.join(p.title),'text':'\n'.join(p.text),'media':p.media,'links':list(dict.fromkeys(p.links))},ensure_ascii=False))
