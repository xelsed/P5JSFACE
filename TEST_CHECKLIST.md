# MediaPipe Face Geometry - Test Checklist

## ✅ Complete Testing Guide

Use this checklist to verify the MediaPipe Face Geometry upgrade is working correctly.

---

## 🚀 Pre-Test Setup

- [ ] Using HTTPS (required for camera access)
- [ ] Modern browser (Chrome 90+, Firefox 88+, Safari 14+)
- [ ] Webcam connected and working
- [ ] Good lighting in room
- [ ] Internet connection (for CDN libraries)

---

## 📋 Initialization Tests

### **1. Page Load**
- [ ] Page loads without errors
- [ ] No 404 errors in Network tab (F12)
- [ ] All MediaPipe scripts loaded successfully
- [ ] Canvas appears on left side
- [ ] Side panel appears on right side

### **2. Console Messages**
Open console (F12) and check for:

```
Expected output:
✓ MediaPipe Face Geometry Module initialized
  - 468 vertices in metric 3D space (cm)
  - Triangular mesh topology
  - UV texture coordinates
  - 4x4 pose transformation matrix
```

- [ ] See "MediaPipe Face Geometry Module initialized"
- [ ] See "468 vertices in metric 3D space (cm)"
- [ ] No error messages in red

### **3. Camera Permission**
- [ ] Browser prompts for camera permission
- [ ] Grant permission (click "Allow")
- [ ] Status bar shows success message
- [ ] No "webcam denied" error

---

## 🎭 Face Detection Tests

### **4. Live Tracking**
- [ ] Show face to camera
- [ ] Yellow dots appear (468 points)
- [ ] Dots move with your face
- [ ] Status shows "1 face" (not "0 faces")

### **5. First Detection Log**
Console should show:
```
✓ First face with geometry detected!
  Vertices: 468
  Sample vertex (metric cm): {x: 2.34, y: -1.56, z: 8.42}
  Z range (cm): -2.45 to 12.38
```

- [ ] See "First face with geometry detected!"
- [ ] Vertices count is 468
- [ ] Sample vertex shows metric cm values
- [ ] **Z range shows real numbers** (e.g., -2.5 to 12.8 cm) ← CRITICAL!

**⚠️ If Z range is -0.5 to 0.5 → Something wrong!**  
Should see -2 to +12 range (centimeters)

### **6. Key Landmarks**
- [ ] Yellow spheres visible on face
- [ ] Sphere on left eye
- [ ] Sphere on right eye
- [ ] Sphere on nose tip
- [ ] Sphere on mouth

---

## 📸 Capture Tests

### **7. Press C Key**
- [ ] Press C to capture
- [ ] Yellow dots change to white dots
- [ ] White spheres appear on key features
- [ ] Status shows "Frozen (MediaPipe 3D)"

### **8. Capture Console Log**
```
✓ Captured MediaPipe Face Geometry: 468 vertices
```

- [ ] See "Captured MediaPipe Face Geometry"
- [ ] Shows 468 vertices
- [ ] No errors

### **9. Frozen Mesh Display**
- [ ] White dots visible (468 points)
- [ ] White spheres on eyes/nose/mouth
- [ ] Mesh stays static (doesn't move with face)
- [ ] Can still rotate camera view

---

## 🎨 3D Tests

### **10. Rotate Camera**
- [ ] Click and drag on canvas
- [ ] Camera rotates around mesh
- [ ] Can see face from different angles
- [ ] **Face has visible DEPTH** (not flat!) ← CRITICAL!

### **11. Depth Verification**
Rotate camera to side view:
- [ ] Face has 3D volume (nose sticks out)
- [ ] Not just a flat surface
- [ ] Can see depth variation clearly
- [ ] Eyes/nose/mouth at different Z depths

**⚠️ If face looks flat → Check Z range in console!**

---

## 🔪 Slicing Tests

### **12. Slice Lines**
After capturing (C key):
- [ ] Horizontal lines appear across face
- [ ] 12 slices by default
- [ ] One line is blue (mouth-aligned)
- [ ] Other lines are green or red

### **13. Adjust Slice Count**
- [ ] Press ] (right bracket) → Slices increase
- [ ] Press [ (left bracket) → Slices decrease
- [ ] Count updates in side panel
- [ ] Lines adjust on face

---

## 🎵 Audio Tests

### **14. Wavetable Generation**
After capturing:
- [ ] Check side panel "Slices" count
- [ ] Should show 12 (or adjusted number)
- [ ] "Collision Total" shows a number
- [ ] Collision list shows slice data

### **15. Sound Playback**
Press number keys 1-9:
- [ ] Press 1 → Hear sound
- [ ] Press 2 → Different sound
- [ ] Press 3-9 → More sounds
- [ ] Status bar shows "Playing slice X"

### **16. Audio Animation**
While pressing 1-9:
- [ ] Slice lights up in GREEN
- [ ] Slice PULSES (animation)
- [ ] Other slices stay normal color
- [ ] Animation stops when released

---

## 🎨 Visualization Tests

### **17. Toggle View (V key)**
- [ ] Press V
- [ ] View switches to "Wavetable"
- [ ] Status shows "Wavetable" (not "Face Geometry")
- [ ] See 3D waveforms instead of face
- [ ] Video preview disappears

### **18. Cycle 3D Modes (M key)**
Press M repeatedly:
- [ ] Mode 1: Stacked Curves (default)
- [ ] Mode 2: 3D Surface (mesh terrain)
- [ ] Mode 3: Bar Graph (histogram)
- [ ] Mode 4: Spiral Radial (circles)
- [ ] Mode 5: Extruded Ribbons (solid)
- [ ] Status bar shows mode name
- [ ] Side panel "3D Mode" updates

### **19. Animated Playback in Each Mode**
For each mode, press 1-9:
- [ ] Curves: Line pulses and glows
- [ ] Surface: Section lights up
- [ ] Bars: Boxes grow/shrink
- [ ] Spiral: Ring expands
- [ ] Extrude: Ribbon glows

---

## 🎮 Control Tests

### **20. Pitch Control**
- [ ] Press - (minus) → Pitch down
- [ ] Press + (plus) → Pitch up
- [ ] Side panel "Pitch" updates
- [ ] Sound changes frequency

### **21. ADSR Envelope**
- [ ] Press a/A → Attack changes
- [ ] Press d/D → Decay changes
- [ ] Press s/S → Sustain changes
- [ ] Press r/R → Release changes
- [ ] Side panel values update

### **22. Time Axis**
- [ ] Press X → Time axis X (left→right)
- [ ] Press Y → Time axis Y (top→bottom)
- [ ] Status bar shows axis mode
- [ ] Sound character changes

### **23. Unfreeze (Escape)**
- [ ] Press Escape
- [ ] White dots → Yellow dots
- [ ] Back to live tracking
- [ ] Status shows "Live tracking"
- [ ] Can capture again with C

---

## 🔬 Advanced Tests

### **24. Console Debugging**
Open console and check:
- [ ] No red error messages
- [ ] No warnings about missing functions
- [ ] Z range shows cm values (not 0-1 range)
- [ ] Vertex count always 468

### **25. Network Tab**
Check F12 → Network:
- [ ] All MediaPipe scripts loaded (200 status)
- [ ] camera_utils.js loaded
- [ ] control_utils.js loaded
- [ ] drawing_utils.js loaded
- [ ] face_mesh.js loaded
- [ ] face_mesh binary files loaded (~5MB total)

### **26. Performance**
Monitor FPS:
- [ ] Runs at 30-45 fps
- [ ] No major frame drops
- [ ] Smooth camera rotation
- [ ] Responsive key presses

---

## 🐛 Troubleshooting Tests

### **27. No Face Detected**
If status shows "0 faces":
- [ ] Improve lighting
- [ ] Face camera directly
- [ ] Move closer to camera
- [ ] Remove glasses if reflective
- [ ] Try different angle

### **28. Flat Appearance**
If face looks 2D:
- [ ] Check console Z range
- [ ] Should be -2 to +12 cm (not -0.5 to 0.5)
- [ ] Refresh page if wrong
- [ ] Check browser console for errors

### **29. No Sound**
If audio doesn't play:
- [ ] Capture face first (C key)
- [ ] Check browser audio not muted
- [ ] Try different slice (1-9)
- [ ] Check side panel shows slices
- [ ] Verify wavetables generated

---

## ✅ Success Criteria

**All systems working if:**

1. ✅ Console shows metric cm Z-range
2. ✅ Face has visible 3D depth
3. ✅ Capture creates 468 white dots
4. ✅ Sound plays on key press
5. ✅ Animations show during playback
6. ✅ All 5 modes cycle correctly
7. ✅ No console errors

**If ALL checked → MediaPipe Face Geometry working perfectly!** 🎉

---

## 📊 Expected vs Actual

### **Console Output Comparison**

**✅ GOOD (Metric coordinates):**
```
Z range (cm): -2.45 to 12.38
Sample vertex: {x: 2.34, y: -1.56, z: 8.42}
```

**❌ BAD (Normalized values):**
```
Z range: -0.5 to 0.5
Sample vertex: {x: 0.23, y: -0.15, z: 0.08}
```

**⚠️ If you see BAD values → MediaPipe Face Geometry not loading!**

---

## 🎯 Final Verification

Run this quick test:

1. **Open page** → Console shows MediaPipe initialized
2. **Show face** → Yellow dots + cm Z-range logged
3. **Press C** → White dots + 468 vertices logged
4. **Rotate camera** → Clear 3D depth visible
5. **Press 1** → Sound plays + green animation
6. **Press M** → Mode changes + status updates
7. **Press V** → Wavetables visible in 3D

**If all 7 steps work → SUCCESS!** ✅

---

## 📋 Checklist Summary

Count your checkmarks:

- **0-10** ❌ Major issues, check setup
- **10-20** ⚠️ Partial working, debug issues
- **20-30** 🟡 Mostly working, minor fixes needed
- **30+** ✅ Fully working!

---

## 🎉 Completion

**Date tested:** _____________

**Result:** ☐ Pass ☐ Fail

**Notes:**
_________________________________
_________________________________
_________________________________

**If all tests pass: Congratulations! You have TRUE 3D facial mesh reconstruction working in your browser!** 🎭✨

This is the most advanced face geometry capture possible in JavaScript!
