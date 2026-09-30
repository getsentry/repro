# Minimal lpunpack: splits an Android dynamic-partitions "super" image into partition images.
# usage: python3 lpunpack.py super.img outdir
import struct, sys, os
f=open(sys.argv[1],'rb'); out=sys.argv[2]; os.makedirs(out,exist_ok=True)
f.seek(4096); g=f.read(52)
magic,ssz=struct.unpack_from('<II',g,0); assert magic==0x616c4467, hex(magic)
mms,slots,lbs=struct.unpack_from('<III',g,40)
base=4096+4096*2
f.seek(base); h=f.read(256)
m,maj,mn,hsz=struct.unpack_from('<IHHI',h,0); assert m==0x414C5030, hex(m)
off=4+2+2+4+32+4+32
def desc(i): return struct.unpack_from('<III',h,off+12*i)
pt,et=desc(0),desc(1)
tables=base+hsz
f.seek(tables+et[0]); ext=[struct.unpack('<QIQI',f.read(et[2])[:24]) for _ in range(et[1])]
f.seek(tables+pt[0])
for _ in range(pt[1]):
    e=f.read(pt[2]); name=e[:36].rstrip(b'\0').decode(); attr,fe,ne,gi=struct.unpack_from('<IIII',e,36)
    print(name, ne)
    with open(f"{out}/{name}.img",'wb') as o:
        for x in ext[fe:fe+ne]:
            nsec,tt,td,ts=x
            if tt==0:
                pos=f.tell(); f.seek(td*512); remaining=nsec*512
                while remaining: b=f.read(min(remaining,1<<24)); o.write(b); remaining-=len(b)
                f.seek(pos)
            else: o.seek(nsec*512,1)
