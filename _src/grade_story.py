"""Grades the story photos into one navy/gold monotone look (1920x1080). Usage: python3 grade_story.py <dir with source PNGs>"""
import numpy as np
from PIL import Image, ImageOps, ImageFilter
import sys
src=sys.argv[1].rstrip('/')+'/'; OUT='assets/img/story/'
stops=[(0,(10,19,48)),(.38,(32,53,101)),(.72,(197,162,140)),(1,(244,240,232))]
xs=np.linspace(0,1,256); L=np.stack([np.interp(xs,[s[0] for s in stops],[s[1][c] for s in stops]) for c in range(3)],1).astype(np.uint8)
rng=np.random.default_rng(3); W,H=1920,1080
def grade(im,g=1.0):
    gray=ImageOps.autocontrast(ImageOps.grayscale(im),cutoff=1.5).filter(ImageFilter.UnsharpMask(2,60,2))
    a=(np.asarray(gray)/255.0)**g
    yy,xx=np.mgrid[0:im.size[1],0:im.size[0]]
    d=np.sqrt(((xx-im.size[0]/2)/(im.size[0]*.62))**2+((yy-im.size[1]/2)/(im.size[1]*.7))**2)
    a=a*(1-0.35*np.clip(d-0.5,0,1)**1.3*1.6)
    a=np.clip(a+rng.normal(0,.018,a.shape),0,1)
    return Image.fromarray(L[(a*255).astype(np.uint8)])
def cover(im,w,h,fx=.5,fy=.5):
    s=max(w/im.width,h/im.height); im=im.resize((int(im.width*s)+1,int(im.height*s)+1),Image.LANCZOS)
    x=int((im.width-w)*fx); y=int((im.height-h)*fy); return im.crop((x,y,x+w,y+h))
def land(name,f,fx=.5,fy=.5,g=1.0):
    im=Image.open(src+f).convert('RGB'); grade(cover(im,W,H,fx,fy),g).save(OUT+name+'.jpg',quality=78,optimize=True,progressive=True)
def portrait_comp(name,f,pbox,g=1.0):
    im=Image.open(src+f).convert('RGB'); x0,y0,x1,y1=pbox; im=im.crop((int(x0*im.width),int(y0*im.height),int(x1*im.width),int(y1*im.height)))
    bg=cover(im,W,H).filter(ImageFilter.GaussianBlur(40)); fg=cover(im,int(H*.8),H)
    canvas=bg.copy(); canvas.paste(fg,(int(W*.52),0))
    g_=grade(canvas,g)
    # dark navy veil on the left so text reads
    arr=np.asarray(g_).astype(float); xx=np.linspace(0,1,W)[None,:,None]; veil=np.clip(1-xx/0.5,0,1)**1.2*0.55
    arr=arr*(1-veil)+np.array([10,19,48])*veil; Image.fromarray(arr.astype(np.uint8)).save(OUT+name+'.jpg',quality=78,optimize=True,progressive=True)

land('lane','lane.png',.5,.5,1.0)
portrait_comp('founder','b.png',(0,0.03,1,0.03+1459*1.25/2053))
land('craft','f.png',.5,.5,.9)
land('market','souq1989.png',.5,.55)
land('souq-today','sign.png',.5,.41,1.0)
land('branches','d.png',.5,.5)
portrait_comp('today','c.png',(0,0,1,1))
