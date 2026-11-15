using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public static class GameInput {
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, IntPtr pid);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from, uint to, bool attach);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr window, out Rect r);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window, ref Point p);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern uint SendInput(uint count, Input[] inputs, int size);
    [StructLayout(LayoutKind.Sequential)] struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct Mouse { public int X,Y; public uint Data,Flags,Time; public UIntPtr Extra; }
    [StructLayout(LayoutKind.Sequential)] struct Key { public ushort Virtual,Scan; public uint Flags,Time; public UIntPtr Extra; }
    [StructLayout(LayoutKind.Explicit)] struct Data {
        [FieldOffset(0)] public Mouse Mouse;
        [FieldOffset(0)] public Key Key;
    }
    [StructLayout(LayoutKind.Sequential)] struct Input { public uint Type; public Data Value; }

    public static void Check(IntPtr window) {
        if (GetForegroundWindow() != window) throw new InvalidOperationException("Game lost focus.");
    }
    public static void Focus(IntPtr window) {
        SetThreadDpiAwarenessContext(new IntPtr(-4));
        if (IsIconic(window)) ShowWindowAsync(window,9);
        SetForegroundWindow(window);
        Thread.Sleep(100);
        if (GetForegroundWindow() != window) {
            uint from=GetCurrentThreadId(), to=GetWindowThreadProcessId(GetForegroundWindow(),IntPtr.Zero);
            bool attached=from!=to && to!=0 && AttachThreadInput(from,to,true);
            try { BringWindowToTop(window); SetForegroundWindow(window); }
            finally { if (attached) AttachThreadInput(from,to,false); }
            Thread.Sleep(150);
        }
        Check(window);
    }
    static void Send(Input input) {
        if (SendInput(1, new Input[] {input}, Marshal.SizeOf(typeof(Input))) != 1)
            throw new InvalidOperationException("Windows rejected game input.");
    }
    static void Keyboard(int scan, uint flags) {
        Send(new Input { Type=1, Value=new Data {Key=new Key {Scan=(ushort)scan, Flags=flags}} });
    }
    public static void Hold(IntPtr window, int scan, bool extended, int ms) {
        uint flags = extended ? 9u : 8u;
        Keyboard(scan, flags);
        try {
            var clock = Stopwatch.StartNew();
            while (clock.ElapsedMilliseconds < ms) { Thread.Sleep(25); Check(window); }
        } finally { Keyboard(scan, flags | 2u); }
    }
    public static void Look(int x, int y) {
        Send(new Input { Value=new Data {Mouse=new Mouse {X=x,Y=y,Flags=1}} });
    }
    public static void Click(IntPtr window, double x, double y) {
        Rect r;
        if (!GetClientRect(window,out r)) throw new InvalidOperationException("Game dimensions unavailable.");
        var p = new Point {X=(int)Math.Round(x*(r.Right-1)), Y=(int)Math.Round(y*(r.Bottom-1))};
        if (!ClientToScreen(window,ref p) || !SetCursorPos(p.X,p.Y)) throw new InvalidOperationException("Cannot position pointer.");
        Check(window);
        Select();
    }
    public static void Scroll(int ticks) {
        Send(new Input { Value=new Data {Mouse=new Mouse {Flags=0x0800,Data=unchecked((uint)(ticks*120))}} });
    }
    public static void Select() {
        Send(new Input { Value=new Data {Mouse=new Mouse {Flags=2}} });
        try { Thread.Sleep(60); } finally { Send(new Input { Value=new Data {Mouse=new Mouse {Flags=4}} }); }
    }
}
