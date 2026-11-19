// BluePrint CAD : aperçu des plans DXF et .des dans l'Explorateur de Windows (vignettes et volet de
// visualisation). Logiciel libre sous licence GNU GPL v3 ou ultérieure.
//
// Le dessin est lu par le même lecteur que le logiciel (apercu.js, ressource de cette DLL), exécuté par le
// moteur JavaScript de Windows (Chakra) ; on dessine ensuite ses traits et ses textes avec GDI+.
// Rien n'est envoyé ailleurs : tout se passe sur l'ordinateur.
//
// Compilé par le compilateur C# fourni avec Windows (.NET Framework 4), voir build.mjs. Enregistré pour
// l'utilisateur par l'installeur (build/installer.nsh), sans regasm.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using IStream = System.Runtime.InteropServices.ComTypes.IStream;

[assembly: System.Reflection.AssemblyTitle("BluePrint CAD - aperçu des plans")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace BluePrint.Apercu
{
    // ------------------------------------------------------------------ Moteur JavaScript (Chakra, JsRT)

    static class Chakra
    {
        const string DLL = "chakra.dll";
        [DllImport(DLL)] static extern int JsCreateRuntime(int attributs, IntPtr service, out IntPtr runtime);
        [DllImport(DLL)] static extern int JsCreateContext(IntPtr runtime, out IntPtr contexte);
        [DllImport(DLL)] static extern int JsSetCurrentContext(IntPtr contexte);
        [DllImport(DLL, CharSet = CharSet.Unicode)] static extern int JsRunScript(string script, UIntPtr source, string url, out IntPtr resultat);
        [DllImport(DLL)] static extern int JsGetGlobalObject(out IntPtr global);
        [DllImport(DLL, CharSet = CharSet.Unicode)] static extern int JsGetPropertyIdFromName(string nom, out IntPtr id);
        [DllImport(DLL)] static extern int JsGetProperty(IntPtr objet, IntPtr id, out IntPtr valeur);
        [DllImport(DLL, CharSet = CharSet.Unicode)] static extern int JsPointerToString(string texte, UIntPtr longueur, out IntPtr valeur);
        [DllImport(DLL)] static extern int JsBoolToBoolean([MarshalAs(UnmanagedType.U1)] bool b, out IntPtr valeur);
        [DllImport(DLL)] static extern int JsGetUndefinedValue(out IntPtr valeur);
        [DllImport(DLL)] static extern int JsCallFunction(IntPtr fonction, IntPtr[] arguments, ushort nombre, out IntPtr resultat);
        [DllImport(DLL)] static extern int JsConvertValueToString(IntPtr valeur, out IntPtr texte);
        [DllImport(DLL)] static extern int JsStringToPointer(IntPtr valeur, out IntPtr caracteres, out UIntPtr longueur);
        [DllImport(DLL)] static extern int JsGetAndClearException(out IntPtr exception);
        [DllImport(DLL)] static extern int JsDisposeRuntime(IntPtr runtime);

        static string script;

        static string Script()
        {
            if (script != null) return script;
            using (var s = typeof(Chakra).Assembly.GetManifestResourceStream("apercu.js"))
            using (var r = new StreamReader(s, Encoding.UTF8)) script = r.ReadToEnd();
            return script;
        }

        static void V(int code, string etape)
        {
            if (code != 0) throw new InvalidOperationException("moteur JavaScript : " + etape + " (" + code + ")" + Exception());
        }

        static string Texte(IntPtr valeur)
        {
            IntPtr t, p;
            UIntPtr n;
            if (JsConvertValueToString(valeur, out t) != 0 || JsStringToPointer(t, out p, out n) != 0) return "";
            return Marshal.PtrToStringUni(p, (int)n.ToUInt32());
        }

        static string Exception()
        {
            IntPtr e;
            return JsGetAndClearException(out e) == 0 ? " : " + Texte(e) : "";
        }

        /// <summary>Appelle <c>fonction(contenu, des)</c> du lecteur et renvoie son résultat.</summary>
        public static string Appeler(string fonction, string contenu, bool des)
        {
            IntPtr runtime;
            V(JsCreateRuntime(0, IntPtr.Zero, out runtime), "démarrage");
            try
            {
                IntPtr contexte, resultat, global, id, f, a, b, indefini;
                V(JsCreateContext(runtime, out contexte), "contexte");
                V(JsSetCurrentContext(contexte), "contexte");
                V(JsRunScript(Script(), UIntPtr.Zero, "apercu.js", out resultat), "lecteur");
                V(JsGetGlobalObject(out global), "global");
                V(JsGetPropertyIdFromName(fonction, out id), fonction);
                V(JsGetProperty(global, id, out f), fonction);
                V(JsPointerToString(contenu, (UIntPtr)(uint)contenu.Length, out a), "fichier");
                V(JsBoolToBoolean(des, out b), "fichier");
                V(JsGetUndefinedValue(out indefini), "appel");
                V(JsCallFunction(f, new[] { indefini, a, b }, 3, out resultat), "lecture");
                return Texte(resultat);
            }
            finally
            {
                JsSetCurrentContext(IntPtr.Zero);
                JsDisposeRuntime(runtime);
            }
        }
    }

    // ------------------------------------------------------------------ Le dessin à montrer

    sealed class Texte
    {
        public double X, Y, H, Angle;
        public char AlignH, AlignV;
        public string Chaine;
    }

    sealed class Dessin
    {
        public double Largeur = 297, Hauteur = 210;
        public readonly List<double> Forts = new List<double>();
        public readonly List<double> Fins = new List<double>();
        public readonly List<Texte> Textes = new List<Texte>();

        /// <summary>Lit un DXF ou un .des (reconnu à son premier octet, « K »).</summary>
        public static Dessin Lire(byte[] octets)
        {
            bool des = octets.Length > 0 && octets[0] == 0x4B;
            // Un caractère par octet (Latin-1) : le lecteur décode lui-même.
            string contenu = Encoding.GetEncoding(28591).GetString(octets);
            string r = Chakra.Appeler("apercuTexte", contenu, des);
            var d = new Dessin();
            var ci = CultureInfo.InvariantCulture;
            foreach (string ligne in r.Split('\n'))
            {
                string[] c = ligne.Split('\t');
                if (c.Length == 0 || c[0].Length != 1) continue;
                switch (c[0][0])
                {
                    case 'E':
                        throw new InvalidDataException(c.Length > 1 ? c[1] : "dessin illisible");
                    case 'P':
                        d.Largeur = double.Parse(c[1], ci);
                        d.Hauteur = double.Parse(c[2], ci);
                        break;
                    case 'F':
                    case 'f':
                        var liste = c[0][0] == 'F' ? d.Forts : d.Fins;
                        for (int i = 1; i <= 4; i++) liste.Add(double.Parse(c[i], ci));
                        break;
                    case 'T':
                        if (c.Length < 7) break;
                        d.Textes.Add(new Texte
                        {
                            X = double.Parse(c[1], ci),
                            Y = double.Parse(c[2], ci),
                            H = double.Parse(c[3], ci),
                            Angle = double.Parse(c[4], ci),
                            AlignH = c[5][0],
                            AlignV = c[5].Length > 1 ? c[5][1] : 'l',
                            Chaine = c[6],
                        });
                        break;
                }
            }
            if (d.Largeur <= 0 || d.Hauteur <= 0) throw new InvalidDataException("format du plan illisible");
            return d;
        }

        /// <summary>La feuille blanche, ses traits (les forts plus épais) et ses textes, centrée dans la zone.</summary>
        public void Dessiner(Graphics g, RectangleF zone, bool textes)
        {
            float k = (float)Math.Min(zone.Width / Largeur, zone.Height / Hauteur);
            float ox = zone.X + (zone.Width - (float)Largeur * k) / 2;
            float oy = zone.Y + (zone.Height - (float)Hauteur * k) / 2;
            float h = (float)Hauteur;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.FillRectangle(Brushes.White, ox, oy, (float)Largeur * k, h * k);
            Func<double, float> X = x => ox + (float)x * k;
            Func<double, float> Y = y => oy + (h - (float)y) * k;
            var traits = new[] { Tuple.Create(Fins, 0.25f, Color.FromArgb(70, 70, 70)), Tuple.Create(Forts, 0.5f, Color.Black) };
            foreach (var t in traits)
            {
                using (var stylo = new Pen(t.Item3, Math.Max(1f, t.Item2 * k)) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                {
                    var l = t.Item1;
                    for (int i = 0; i + 3 < l.Count; i += 4) g.DrawLine(stylo, X(l[i]), Y(l[i + 1]), X(l[i + 2]), Y(l[i + 3]));
                }
            }
            if (!textes) return;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
            foreach (var t in Textes)
            {
                float taille = (float)(t.H / 0.716) * k; // hauteur des majuscules -> corps
                if (taille < 3f) continue; // illisible à cette taille
                using (var police = new Font("Arial", taille, GraphicsUnit.Pixel))
                using (var format = new StringFormat(StringFormat.GenericTypographic))
                {
                    format.FormatFlags |= StringFormatFlags.NoWrap | StringFormatFlags.MeasureTrailingSpaces;
                    format.Alignment = t.AlignH == 'c' ? StringAlignment.Center : t.AlignH == 'd' ? StringAlignment.Far : StringAlignment.Near;
                    format.LineAlignment = t.AlignV == 'h' ? StringAlignment.Near : t.AlignV == 'm' ? StringAlignment.Center : StringAlignment.Far;
                    var etat = g.Save();
                    g.TranslateTransform(X(t.X), Y(t.Y));
                    g.RotateTransform(-(float)t.Angle);
                    // Ligne de base : le bas des lettres sans jambage.
                    float bas = t.AlignV == 'l' ? taille * 0.21f : 0;
                    g.DrawString(t.Chaine, police, Brushes.Black, 0, bas, format);
                    g.Restore(etat);
                }
            }
        }
    }

    // ------------------------------------------------------------------ Interfaces de l'Explorateur

    [ComImport, Guid("b824b49d-22ac-4161-ac8a-9916e8fa3f7f"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IInitializeWithStream
    {
        void Initialize(IStream flux, uint mode);
    }

    [ComImport, Guid("e357fccd-a995-4576-b01f-234630154e96"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IThumbnailProvider
    {
        void GetThumbnail(uint taille, out IntPtr bitmap, out uint alpha);
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Gauche, Haut, Droite, Bas;
        public Rectangle Rectangle { get { return Rectangle.FromLTRB(Gauche, Haut, Droite, Bas); } }
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public IntPtr Fenetre;
        public uint Message;
        public IntPtr W, L;
        public uint Temps;
        public int X, Y;
    }

    [ComImport, Guid("8895b1c6-b41f-4c1c-a562-0d564250836f"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPreviewHandler
    {
        void SetWindow(IntPtr fenetre, ref RECT rect);
        void SetRect(ref RECT rect);
        void DoPreview();
        void Unload();
        void SetFocus();
        void QueryFocus(out IntPtr fenetre);
        [PreserveSig] uint TranslateAccelerator(ref MSG msg);
    }

    [ComImport, Guid("fc4801a3-2ba9-11cf-a229-00aa003d7352"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IObjectWithSite
    {
        void SetSite([MarshalAs(UnmanagedType.IUnknown)] object site);
        void GetSite(ref Guid riid, [MarshalAs(UnmanagedType.IUnknown)] out object site);
    }

    [ComImport, Guid("00000114-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IOleWindow
    {
        void GetWindow(out IntPtr fenetre);
        void ContextSensitiveHelp([MarshalAs(UnmanagedType.Bool)] bool entrer);
    }

    static class Journal
    {
        /// <summary>Note une erreur dans %LOCALAPPDATA%Low\BluePrint CAD\apercu.txt (pour les signalements).</summary>
        public static bool Trace = File.Exists(Path.Combine(Path.GetTempPath(), "BluePrintApercu.trace"));

        public static void Suivre(string quoi)
        {
            if (Trace) Noter(quoi, null);
        }

        public static void Noter(string quoi, Exception e)
        {
            try
            {
                string dossier = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + "Low\\BluePrint CAD";
                Directory.CreateDirectory(dossier);
                File.AppendAllText(Path.Combine(dossier, "apercu.txt"), DateTime.Now.ToString("s") + " " + quoi + (e != null ? " : " + e : "") + Environment.NewLine);
            }
            catch { }
        }
    }

    static class Flux
    {
        /// <summary>Tout le contenu d'un flux de l'Explorateur (64 Mo au plus).</summary>
        public static byte[] Lire(IStream flux)
        {
            var sortie = new MemoryStream();
            var tampon = new byte[65536];
            IntPtr lu = Marshal.AllocCoTaskMem(4);
            try
            {
                while (sortie.Length < 64L * 1024 * 1024)
                {
                    flux.Read(tampon, tampon.Length, lu);
                    int n = Marshal.ReadInt32(lu);
                    if (n <= 0) break;
                    sortie.Write(tampon, 0, n);
                }
            }
            finally
            {
                Marshal.FreeCoTaskMem(lu);
                Marshal.ReleaseComObject(flux);
            }
            return sortie.ToArray();
        }
    }

    // ------------------------------------------------------------------ Vignettes

    [ComVisible(true), Guid("3740D409-1DA1-46D6-8692-11D942B815F7"), ClassInterface(ClassInterfaceType.None)]
    public class Vignette : IInitializeWithStream, IThumbnailProvider
    {
        byte[] octets;

        public void Initialize(IStream flux, uint mode)
        {
            octets = Flux.Lire(flux);
        }

        public void GetThumbnail(uint taille, out IntPtr bitmap, out uint alpha)
        {
            Dessin d;
            try { d = Dessin.Lire(octets ?? new byte[0]); }
            catch (Exception e)
            {
                Journal.Noter("vignette", e);
                throw;
            }
            double k = taille / Math.Max(d.Largeur, d.Hauteur);
            int l = Math.Max(1, (int)Math.Round(d.Largeur * k));
            int h = Math.Max(1, (int)Math.Round(d.Hauteur * k));
            using (var image = new Bitmap(l, h, System.Drawing.Imaging.PixelFormat.Format32bppRgb))
            {
                using (var g = Graphics.FromImage(image)) d.Dessiner(g, new RectangleF(0, 0, l, h), taille >= 256);
                bitmap = image.GetHbitmap(Color.White);
            }
            alpha = 1; // WTSAT_RGB : image opaque
        }
    }

    /// <summary>Pour essayer sans l'Explorateur (PowerShell) : l'image d'un plan dans un fichier PNG.</summary>
    public static class Essai
    {
        public static string Png(string fichier, string png, int taille)
        {
            var d = Dessin.Lire(File.ReadAllBytes(fichier));
            double k = taille / Math.Max(d.Largeur, d.Hauteur);
            int l = (int)Math.Round(d.Largeur * k), h = (int)Math.Round(d.Hauteur * k);
            using (var image = new Bitmap(l, h))
            {
                using (var g = Graphics.FromImage(image))
                {
                    g.Clear(Color.Gray);
                    d.Dessiner(g, new RectangleF(0, 0, l, h), true);
                }
                image.Save(png, System.Drawing.Imaging.ImageFormat.Png);
            }
            return string.Format(CultureInfo.InvariantCulture, "{0} : {1} x {2} mm, {3} traits forts, {4} fins, {5} textes", Path.GetFileName(fichier), d.Largeur, d.Hauteur, d.Forts.Count / 4, d.Fins.Count / 4, d.Textes.Count);
        }
    }

    // ------------------------------------------------------------------ Volet de visualisation

    /// <summary>
    /// Le fil de l'aperçu : l'Explorateur appelle le gestionnaire depuis un fil sans boucle de messages, où une
    /// fenêtre ne serait jamais dessinée. La fenêtre de l'aperçu vit donc sur ce fil, qui a la sienne.
    /// </summary>
    static class FilAffichage
    {
        static Control relais;
        static readonly object verrou = new object();

        public static void Executer(Action action)
        {
            lock (verrou)
            {
                if (relais == null)
                {
                    var pret = new ManualResetEvent(false);
                    var fil = new Thread(() =>
                    {
                        relais = new Control();
                        relais.CreateControl();
                        pret.Set();
                        Application.Run();
                    });
                    fil.SetApartmentState(ApartmentState.STA);
                    fil.IsBackground = true;
                    fil.Name = "BluePrint CAD : aperçu";
                    fil.Start();
                    pret.WaitOne();
                }
            }
            if (relais.InvokeRequired) relais.Invoke(action);
            else action();
        }
    }

    sealed class Vue : Control
    {
        public Dessin Dessin;
        public string Erreur;

        public Vue()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.UserPaint, true);
            BackColor = Color.FromArgb(128, 128, 128);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Journal.Suivre("OnPaint " + e.ClipRectangle + " " + Size);
            e.Graphics.Clear(BackColor);
            var zone = new RectangleF(8, 8, Math.Max(1, Width - 16), Math.Max(1, Height - 16));
            if (Dessin != null) Dessin.Dessiner(e.Graphics, zone, true);
            else if (Erreur != null) TextRenderer.DrawText(e.Graphics, "Aperçu impossible : " + Erreur, Font, Rectangle.Round(zone), Color.White, TextFormatFlags.WordBreak);
        }
    }

    [ComVisible(true), Guid("EF0E0296-BDEC-49B2-A0E3-D062D12C9DA5"), ClassInterface(ClassInterfaceType.None)]
    public class Visualisation : IInitializeWithStream, IPreviewHandler, IObjectWithSite, IOleWindow
    {
        public Visualisation() { Journal.Suivre("Visualisation créée"); }

        [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr enfant, IntPtr parent);
        [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr fenetre);
        [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr fenetre);
        [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr fenetre, int index);
        [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr fenetre, out RECT rect);

        void Etat(string quoi)
        {
            if (!Journal.Trace || vue == null) return;
            RECT r;
            GetWindowRect(vue.Handle, out r);
            Journal.Suivre(quoi + " : parent " + GetParent(vue.Handle) + " (attendu " + parent + "), visible " + IsWindowVisible(vue.Handle) + ", style " + GetWindowLong(vue.Handle, -16).ToString("X") + ", écran " + r.Rectangle);
        }

        byte[] octets;
        IntPtr parent;
        Rectangle cadre;
        Vue vue;
        object site;

        public void Initialize(IStream flux, uint mode)
        {
            octets = Flux.Lire(flux);
            Journal.Suivre("Initialize " + octets.Length);
        }

        public void SetWindow(IntPtr fenetre, ref RECT rect)
        {
            Journal.Suivre("SetWindow " + fenetre + " " + rect.Rectangle);
            parent = fenetre;
            cadre = rect.Rectangle;
            FilAffichage.Executer(() =>
            {
                if (vue == null) return;
                SetParent(vue.Handle, parent);
                vue.Bounds = cadre;
            });
        }

        public void SetRect(ref RECT rect)
        {
            Journal.Suivre("SetRect " + rect.Rectangle);
            cadre = rect.Rectangle;
            FilAffichage.Executer(() =>
            {
                if (vue != null) vue.Bounds = cadre;
                Etat("SetRect");
            });
        }

        public void DoPreview()
        {
            Journal.Suivre("DoPreview");
            Dessin dessin = null;
            string erreur = null;
            try { dessin = Dessin.Lire(octets ?? new byte[0]); }
            catch (Exception e)
            {
                Journal.Noter("aperçu", e);
                erreur = e.Message;
            }
            try
            {
                FilAffichage.Executer(() =>
                {
                    if (vue == null)
                    {
                        vue = new Vue();
                        vue.CreateControl();
                    }
                    vue.Dessin = dessin;
                    vue.Erreur = erreur;
                    SetParent(vue.Handle, parent);
                    vue.Bounds = cadre;
                    vue.Visible = true;
                    vue.Invalidate();
                    Etat("DoPreview");
                });
            }
            catch (Exception e)
            {
                Journal.Noter("DoPreview", e);
                throw;
            }
        }

        public void Unload()
        {
            Journal.Suivre("Unload");
            FilAffichage.Executer(() =>
            {
                if (vue != null)
                {
                    vue.Dispose();
                    vue = null;
                }
            });
            octets = null;
        }

        public void SetFocus() { FilAffichage.Executer(() => { if (vue != null) vue.Focus(); }); }

        public void QueryFocus(out IntPtr fenetre)
        {
            IntPtr f = IntPtr.Zero;
            FilAffichage.Executer(() => { if (vue != null && vue.Focused) f = vue.Handle; });
            fenetre = f;
        }

        public uint TranslateAccelerator(ref MSG msg) { return 1; } // S_FALSE : non traité

        public void SetSite(object s)
        {
            Journal.Suivre("SetSite " + (s != null));
            site = s;
        }

        public void GetSite(ref Guid riid, out object s) { s = site; }

        public void GetWindow(out IntPtr fenetre) { fenetre = parent; }

        public void ContextSensitiveHelp(bool entrer) { throw new NotImplementedException(); }
    }
}
