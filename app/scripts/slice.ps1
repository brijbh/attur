param([string]$Sheet, [string]$OutDir)
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Collections.Generic;
public static class Slicer {
  public static void Run(string sheet, string outDir, string[] names) {
    var src = new Bitmap(sheet); int n = 4; int cw = src.Width / n, ch = src.Height / n;
    for (int r = 0; r < n; r++) for (int c = 0; c < n; c++) {
      var bmp = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
      using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, new Rectangle(0,0,cw,ch), new Rectangle(c*cw, r*ch, cw, ch), GraphicsUnit.Pixel);
      var seen = new bool[cw, ch]; var q = new Queue<Point>();
      for (int x = 0; x < cw; x++) { q.Enqueue(new Point(x,0)); q.Enqueue(new Point(x,ch-1)); }
      for (int y = 0; y < ch; y++) { q.Enqueue(new Point(0,y)); q.Enqueue(new Point(cw-1,y)); }
      while (q.Count > 0) {
        var p = q.Dequeue(); if (p.X<0||p.Y<0||p.X>=cw||p.Y>=ch||seen[p.X,p.Y]) continue;
        seen[p.X,p.Y] = true; var px = bmp.GetPixel(p.X,p.Y);
        int m = Math.Min(px.R, Math.Min(px.G, px.B));
        if (m < 225) continue;
        bmp.SetPixel(p.X,p.Y, Color.FromArgb(m > 245 ? 0 : (255 - m) * 8, px));
        q.Enqueue(new Point(p.X+1,p.Y)); q.Enqueue(new Point(p.X-1,p.Y)); q.Enqueue(new Point(p.X,p.Y+1)); q.Enqueue(new Point(p.X,p.Y-1));
      }
      bmp.Save(System.IO.Path.Combine(outDir, names[r*n+c] + ".png"), ImageFormat.Png); bmp.Dispose();
    }
  }
}
"@
$names = 'ball','hat','cap','bat','umbrella','book','apple','clock','bell','key','shoe','cup','kite','teddy','lamp','pencil'
New-Item -ItemType Directory -Force $OutDir | Out-Null
[Slicer]::Run((Resolve-Path $Sheet).Path, (Resolve-Path $OutDir).Path, $names)
