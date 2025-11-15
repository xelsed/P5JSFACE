# Quick Start Guide - MediaPipe Face Geometry Edition

## ⚡ 30-Second Setup

1. **Open** `index.html` in browser (HTTPS required)
2. **Grant** camera permission
3. **Show face** to camera → Yellow dots appear
4. **Press C** → Capture face (white dots)
5. **Press V** → Toggle to wavetable view
6. **Press 1-9** → Play sounds from your face!

**That's it!** Your facial geometry is now audio. 🎵

---

## 🎮 Essential Controls

```
C      = Capture face geometry
Esc    = Unfreeze, go back to live
V      = Toggle view (Face/Wavetable)
M      = Cycle 3D modes (5 styles)
1-9    = Play wavetable slices
-/+    = Pitch down/up
Mouse  = Rotate camera
```

---

## ✅ What Should Happen

### **1. Initialization**
```
Console shows:
✓ MediaPipe Face Geometry Module initialized
  - 468 vertices in metric 3D space (cm)
```

### **2. Face Detection**
```
Console shows:
✓ First face with geometry detected!
  Vertices: 468
  Z range (cm): -2.45 to 12.38  ← Real depth!
```

### **3. Capture**
```
Console shows:
✓ Captured MediaPipe Face Geometry: 468 vertices

Screen shows:
- White dots (frozen mesh)
- Colored spheres on eyes/nose/mouth
- Status: "Frozen (MediaPipe 3D)"
```

### **4. Wavetables**
```
Press V → See 3D waveforms
Press M → Cycle modes (curves/surface/bars/spiral/extrude)
Press 1 → Hear slice 1 (green pulse animation)
```

---

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| No camera | Use HTTPS, grant permission |
| No face detected | Better lighting, face camera |
| Flat appearance | Refresh page, check console |
| No sound | Capture first (C), then press 1-9 |
| Can't rotate | Click and drag on canvas |

---

## 🎯 Key Features

✅ **True 3D mesh** (not just points)  
✅ **Metric coordinates** (centimeters)  
✅ **5 visualization modes**  
✅ **Animated playback**  
✅ **Unique per-face audio**  

---

## 📊 Console Checklist

Open console (F12) and verify:

- [x] "MediaPipe Face Geometry Module initialized"
- [x] "First face with geometry detected"
- [x] "Z range (cm): -2.X to 12.X" ← Should see real cm values!
- [x] "Captured MediaPipe Face Geometry: 468 vertices"

**If all checked → Working correctly!** ✅

---

## 🎨 Try This

1. **Capture different expressions**
   - Smile → Different waveforms
   - Neutral → Different sound
   - Each expression = new audio

2. **Rotate camera**
   - See TRUE 3D depth
   - Face has volume, not flat
   - Wavetables show in 3D space

3. **Cycle modes** (Press M)
   - Curves → Classic view
   - Surface → Flowing terrain
   - Bars → Rhythmic histogram
   - Spiral → Circular mandala
   - Extrude → Bold ribbons

4. **Play slices**
   - Press 1-9 rapidly
   - Watch green animation
   - Hear different tones

---

## 🚀 Advanced Usage

### **Adjust Slices**
```
[ = Decrease (min 2)
] = Increase (max 64)
```

### **Change Time Axis**
```
X = Horizontal (left→right)
Y = Vertical (top→bottom)
```

### **Modify ADSR**
```
a/A = Attack time
d/D = Decay time
s/S = Sustain level
r/R = Release time
```

---

## 💡 What Makes This Special

**MediaPipe Face Geometry provides:**

- 468 vertices in **centimeters** (not normalized)
- Triangle mesh topology (actual surface)
- UV texture coordinates
- 4×4 pose matrix

**This is the ONLY browser solution for true 3D facial mesh!**

---

## 🎯 Expected Results

### **Good Z-range** ✅
```
Z range (cm): -2.45 to 12.38
```
Real centimeter measurements!

### **Bad Z-range** ❌
```
Z range: -0.5 to 0.5
```
Normalized values = something wrong!

---

## 📸 Visual Indicators

**Live Tracking:**
- 🟡 Yellow dots (468 vertices)
- 🟡 Yellow spheres (key landmarks)
- Updates in real-time

**Frozen Mesh:**
- ⚪ White dots (captured vertices)
- ⚪ White spheres (key features)
- 🔵 Blue line (mouth slice)
- Static until unfrozen

**Playing Audio:**
- 🟢 Green curves/shapes
- Pulsing animation
- Brighter colors

---

## ⚡ Performance Tips

1. **Single face only** - maxNumFaces: 1
2. **Good lighting** - Improves detection speed
3. **Face camera** - Reduces processing time
4. **Close browser tabs** - More CPU available
5. **Modern browser** - Chrome 90+ recommended

---

## 🎵 Understanding the Audio

**Your face creates unique sound because:**

- Nose shape → Harmonic content
- Jawline → Bass character
- Lips → High frequencies
- Depth → Amplitude envelope

**Each person's facial geometry = unique wavetables!**

---

## 🔬 Technical Stack

```
MediaPipe Face Geometry (true 3D mesh)
    ↓
p5.js WebGL (3D visualization)
    ↓
Web Audio API (synthesis)
    ↓
Your ears 🎧
```

**All client-side, no server needed!**

---

## ✅ Success Indicators

You know it's working when:

1. ✅ Yellow dots move with your face
2. ✅ Console shows cm measurements
3. ✅ White dots appear after pressing C
4. ✅ Colored spheres visible on features
5. ✅ 3D depth visible when rotating
6. ✅ Sound plays when pressing 1-9
7. ✅ Green animation during playback

---

## 🎯 Next Steps

Once working:

1. **Try different faces** - See how audio changes
2. **Experiment with modes** - Find favorite visualization
3. **Adjust slices** - More/fewer for different effects
4. **Modify ADSR** - Shape the sound envelope
5. **Change pitch** - Explore harmonic range

---

## 🏆 You Did It!

If you can:
- See yellow/white dots ✅
- Rotate and see 3D depth ✅
- Press keys and hear sound ✅

**You're successfully using MediaPipe Face Geometry!**

This is the most advanced face-to-audio system possible in a browser! 🎉

---

**Need help?** Check console (F12) for error messages.

**Working great?** Explore the 5 visualization modes! 🎨
