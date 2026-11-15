#!/usr/bin/env python3
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'
CONFIG={
'hunt':('assets/treasure-hunt.jpg','assets/treasure-hunt-navfree.jpg',.413,.636,61),
'fresh':('assets/fresh-finds.jpg','assets/fresh-finds-navfree.jpg',.402,.640,61),
'apothecary':('rachaels-apothecary.jpg','assets/rachaels-apothecary-navfree.jpg',.410,.634,61),
'underground':('assets/autumns-underground.jpg','assets/autumns-underground-navfree.jpg',.403,.642,61),
'journal':('assets/treasure-journal.jpg','assets/treasure-journal-navfree.jpg',.408,.648,38),
}
def clean(src,L,R,top):
    h,w=src.shape[:2]
    x=np.arange(w,dtype=np.float32);y=np.arange(h,dtype=np.float32)
    f=max(10,w*.016)
    keep=np.clip(np.minimum((x-L*w)/f,(R*w-x)/f),0,1)
    keep=keep*keep*(3-2*keep)
    dy=top*np.power(np.clip(1-y/(top*4.0),0,1),1.8)
    mapx=np.broadcast_to(x[None,:],(h,w)).astype(np.float32)
    mapy=np.clip(y[:,None]+dy[:,None]*(1-keep[None,:]),0,h-1).astype(np.float32)
    return cv2.remap(src,mapx,mapy,cv2.INTER_CUBIC)
def main():
    for name,(src,dest,l,r,top) in CONFIG.items():
        original=cv2.imread(str(ROOT/src))
        if original is None:raise FileNotFoundError(src)
        result=clean(original,l,r,top)
        dst=ROOT/dest
        dst.parent.mkdir(exist_ok=True,parents=True)
        if not cv2.imwrite(str(dst),result,[cv2.IMWRITE_JPEG_QUALITY,91]):raise OSError(dest)
        print(name,dest,result.shape[:2])
    home=Image.open(ASSETS/'Aladdin’s Lamp Hidden Treasures Homepage.png').convert('RGB')
    home.crop((0,66,home.width,home.height)).save(ASSETS/'home-navfree.jpg',quality=91,optimize=True,subsampling=0)
    names={'home':'home-navfree.jpg','hunt':'treasure-hunt-navfree.jpg','fresh':'fresh-finds-navfree.jpg','apothecary':'rachaels-apothecary-navfree.jpg','underground':'autumns-underground-navfree.jpg','journal':'treasure-journal-navfree.jpg'}
    sheet=Image.new('RGB',(1200,1080),'#10191a');draw=ImageDraw.Draw(sheet)
    for i,(name,file) in enumerate(names.items()):
        im=Image.open(ASSETS/file);im.thumbnail((585,323))
        x=i%2*600+(600-im.width)//2;y=i//2*360+5
        sheet.paste(im,(x,y));draw.text((i%2*600+12,i//2*360+335),name,fill='#fff0b9')
    (ROOT/'artifacts').mkdir(exist_ok=True)
    sheet.save(ROOT/'artifacts/navfree-six-review.jpg',quality=87)
if __name__=='__main__':main()

# Source artwork remains unchanged. Review all generated images before promotion.
