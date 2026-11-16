# Contact sheet of every concept in breeds.csv order: concepts/board.png
import csv
from PIL import Image, ImageDraw
rows=list(csv.DictReader(open('breeds.csv')))
S,C=300,6
im=Image.new('RGB',(S*C,(S+24)*((len(rows)+C-1)//C)),'white'); d=ImageDraw.Draw(im)
for i,r in enumerate(rows):
  t=Image.open(f"concepts/{r['slug']}.png").convert('RGB'); w,h=t.size
  t=t.crop((w*.1,h*.1,w*.9,h*.9)).resize((S,S))
  x,y=(i%C)*S,(i//C)*(S+24); im.paste(t,(x,y+24)); d.text((x+6,y+6),f"{i+1}. {r['breed']}",fill='black')
im.save('concepts/board.png')
