//
//  editVoxels.js
//  hifi
//
//  Created by Philip Rosedale on February 8, 2014
//  Copyright (c) 2014 HighFidelity, Inc. All rights reserved.
//
//  Captures mouse clicks and edits voxels accordingly.
//
//  click = create a new voxel on this face, same color as old (default color picker state)
//  right click or control + click = delete this voxel 
//  shift + click = recolor this voxel
//  1 - 8 = pick new color from palette
//  9 = create a new voxel in front of the camera 
//
//  Click and drag to create more new voxels in the same direction
//

var windowDimensions = Controller.getViewportDimensions();

var NEW_VOXEL_SIZE = 1.0;
var NEW_VOXEL_DISTANCE_FROM_CAMERA = 3.0;
var ORBIT_RATE_ALTITUDE = 200.0;
var ORBIT_RATE_AZIMUTH = 90.0;
var PIXELS_PER_EXTRUDE_VOXEL = 16;

var zFightingSizeAdjust = 0.002; // used to adjust preview voxels to prevent z fighting
var previewLineWidth = 1.5;

var oldMode = Camera.getMode();

var isAdding = false; 
var isExtruding = false; 
var isOrbiting = false;
var isOrbitingFromTouch = false;
var isPanning = false;
var isPanningFromTouch = false;
var touchPointsToOrbit = 2; // you can change these, but be mindful that on some track pads 2 touch points = right click+drag
var touchPointsToPan = 3; 
var orbitAzimuth = 0.0;
var orbitAltitude = 0.0;
var orbitCenter = { x: 0, y: 0, z: 0 };
var orbitPosition = { x: 0, y: 0, z: 0 };
var orbitRadius = 0.0;
var extrudeDirection = { x: 0, y: 0, z: 0 };
var extrudeScale = 0.0;
var lastVoxelPosition = { x: 0, y: 0, z: 0 };
var lastVoxelColor = { red: 0, green: 0, blue: 0 };
var lastVoxelScale = 0;
var dragStart = { x: 0, y: 0 };

var mouseX = 0;
var mouseY = 0; 

//  Create a table of the different colors you can choose
var colors = new Array();
colors[0] = { red: 237, green: 175, blue: 0 };
colors[1] = { red: 61,  green: 211, blue: 72 };
colors[2] = { red: 51,  green: 204, blue: 204 };
colors[3] = { red: 63,  green: 169, blue: 245 };
colors[4] = { red: 193, green: 99,  blue: 122 };
colors[5] = { red: 255, green: 54,  blue: 69 };
colors[6] = { red: 124, green: 36,  blue: 36 };
colors[7] = { red: 63,  green: 35,  blue: 19 };
var numColors = 8;
var whichColor = -1;            //  Starting color is 'Copy' mode

//  Create sounds for adding, deleting, recoloring voxels 
var addSound = new Sound("https://s3-us-west-1.amazonaws.com/highfidelity-public/sounds/Voxels/voxel+create.raw");
var deleteSound = new Sound("https://s3-us-west-1.amazonaws.com/highfidelity-public/sounds/Voxels/voxel+delete.raw");
var changeColorSound = new Sound("https://s3-us-west-1.amazonaws.com/highfidelity-public/sounds/Voxels/voxel+edit.raw");
var clickSound = new Sound("https://s3-us-west-1.amazonaws.com/highfidelity-public/sounds/Switches+and+sliders/toggle+switch+-+medium.raw");
var audioOptions = new AudioInjectionOptions(); 
audioOptions.volume = 0.5;
audioOptions.position = Vec3.sum(MyAvatar.position, { x: 0, y: 1, z: 0 }  ); // start with audio slightly above the avatar

var editToolsOn = false; // starts out off


// previewAsVoxel - by default, we will preview adds/deletes/recolors as just 4 lines on the intersecting face. But if you
//                  the preview to show a full voxel then set this to true and the voxel will be displayed for voxel editing
var previewAsVoxel = false; 

var voxelPreview = Overlays.addOverlay("cube", {
                    position: { x: 0, y: 0, z: 0},
                    size: 1,
                    color: { red: 255, green: 0, blue: 0},
                    alpha: 1,
                    solid: false,
                    visible: false,
                    lineWidth: 4
                });
                
var linePreviewTop = Overlays.addOverlay("line3d", {
                    position: { x: 0, y: 0, z: 0},
                    end: { x: 0, y: 0, z: 0},
                    color: { red: 255, green: 255, blue: 255},
                    alpha: 1,
                    visible: false,
                    lineWidth: previewLineWidth
                });

var linePreviewBottom = Overlays.addOverlay("line3d", {
                    position: { x: 0, y: 0, z: 0},
                    end: { x: 0, y: 0, z: 0},
                    color: { red: 255, green: 255, blue: 255},
                    alpha: 1,
                    visible: false,
                    lineWidth: previewLineWidth
                });

var linePreviewLeft = Overlays.addOverlay("line3d", {
                    position: { x: 0, y: 0, z: 0},
                    end: { x: 0, y: 0, z: 0},
                    color: { red: 255, green: 255, blue: 255},
                    alpha: 1,
                    visible: false,
                    lineWidth: previewLineWidth
                });

var linePreviewRight = Overlays.addOverlay("line3d", {
                    position: { x: 0, y: 0, z: 0},
                    end: { x: 0, y: 0, z: 0},
                    color: { red: 255, green: 255, blue: 255},
                    alpha: 1,
                    visible: false,
                    lineWidth: previewLineWidth
                });


// these will be used below
var sliderWidth = 158;
var sliderHeight = 35;

// These will be our "overlay IDs"
var swatches = new Array();
var swatchHeight = 54;
var swatchWidth = 31;
var swatchesWidth = swatchWidth * numColors;
var swatchesX = (windowDimensions.x - (swatchesWidth + sliderWidth)) / 2;
var swatchesY = windowDimensions.y - swatchHeight;

// create the overlays, position them in a row, set their colors, and for the selected one, use a different source image
// location so that it displays the "selected" marker
for (s = 0; s < numColors; s++) {
    var imageFromX = 12 + (s * 27);
    var imageFromY = 0;
    if (s == whichColor) {
        imageFromY = 55;
    }
    var swatchX = swatchesX + (30 * s);

    swatches[s] = Overlays.addOverlay("image", {
                    x: swatchX,
                    y: swatchesY,
                    width: swatchWidth,
                    height: swatchHeight,
                    subImage: { x: imageFromX, y: imageFromY, width: (swatchWidth - 1), height: swatchHeight },
                    imageURL: "http://highfidelity-public.s3-us-west-1.amazonaws.com/images/testing-swatches.svg",
                    color: colors[s],
                    alpha: 1,
                    visible: editToolsOn
                });
}


// These will be our tool palette overlays
var numberOfTools = 5;
var toolHeight = 40;
var toolWidth = 62;
var toolsHeight = toolHeight * numberOfTools;
var toolsX = 0;
var toolsY = (windowDimensions.y - toolsHeight) / 2;

var addToolAt = 0;
var deleteToolAt = 1;
var recolorToolAt = 2;
var eyedropperToolAt = 3;
var selectToolAt = 4;
var toolSelectedColor = { red: 255, green: 255, blue: 255 };
var notSelectedColor = { red: 128, green: 128, blue: 128 };

var addTool = Overlays.addOverlay("image", {
                    x: 0, y: 0, width: toolWidth, height: toolHeight,
                    subImage: { x: 0, y: toolHeight * addToolAt, width: toolWidth, height: toolHeight },
                    imageURL: "https://s3-us-west-1.amazonaws.com/highfidelity-public/images/hifi-interface-tools.svg",
                    color: toolSelectedColor,
                    visible: false,
                    alpha: 0.9
                });

var deleteTool = Overlays.addOverlay("image", {
                    x: 0, y: 0, width: toolWidth, height: toolHeight,
                    subImage: { x: 0, y: toolHeight * deleteToolAt, width: toolWidth, height: toolHeight },
                    imageURL: "https://s3-us-west-1.amazonaws.com/highfidelity-public/images/hifi-interface-tools.svg",
                    color: toolSelectedColor,
                    visible: false,
                    alpha: 0.9
                });

var recolorTool = Overlays.addOverlay("image", {
                    x: 0, y: 0, width: toolWidth, height: toolHeight,
                    subImage: { x: 0, y: toolHeight * recolorToolAt, width: toolWidth, height: toolHeight },
                    imageURL: "https://s3-us-west-1.amazonaws.com/highfidelity-public/images/hifi-interface-tools.svg",
                    color: toolSelectedColor,
                    visible: false,
                    alpha: 0.9
                });

var eyedropperTool = Overlays.addOverlay("image", {
                    x: 0, y: 0, width: toolWidth, height: toolHeight,
                    subImage: { x: 0, y: toolHeight * eyedropperToolAt, width: toolWidth, height: toolHeight },
                    imageURL: "https://s3-us-west-1.amazonaws.com/highfidelity-public/images/hifi-interface-tools.svg",
                    color: toolSelectedColor,
                    visible: false,
                    alpha: 0.9
                });

var selectTool = Overlays.addOverlay("image", {
                    x: 0, y: 0, width: toolWidth, height: toolHeight,
                    subImage: { x: 0, y: toolHeight * selectToolAt, width: toolWidth, height: toolHeight },
                    imageURL: "https://s3-us-west-1.amazonaws.com/highfidelity-public/images/hifi-interface-tools.svg",
                    color: toolSelectedColor,
                    visible: false,
                    alpha: 0.9
                });
                
                
// This will create a couple of image overlays that make a "slider", we will demonstrate how to trap mouse messages to
// move the slider

// see above...
//var sliderWidth = 158;
//var sliderHeight = 35;

var sliderX = swatchesX + swatchesWidth;
var sliderY = windowDimensions.y - sliderHeight;
var slider = Overlays.addOverlay("image", {
                    // alternate form of expressing bounds
                    bounds: { x: sliderX, y: sliderY, width: sliderWidth, height: sliderHeight},
                    imageURL: "https://s3-us-west-1.amazonaws.com/highfidelity-public/images/slider.png",
                    color: { red: 255, green: 255, blue: 255},
                    alpha: 1,
                    visible: false
                });


// The slider is handled in the mouse event callbacks.
var isMovingSlider = false;
var thumbClickOffsetX = 0;

// This is the thumb of our slider
var minThumbX = 30; // relative to the x of the slider
var maxThumbX = minThumbX + 65;
var thumbExtents = maxThumbX - minThumbX;
var thumbX = (minThumbX + maxThumbX) / 2;
var thumbY = sliderY + 9;
var thumb = Overlays.addOverlay("image", {
                    x: sliderX + thumbX,
                    y: thumbY,
                    width: 18,
                    height: 17,
                    imageURL: "https://s3-us-west-1.amazonaws.com/highfidelity-public/images/thumb.png",
                    color: { red: 255, green: 255, blue: 255},
                    alpha: 1,
                    visible: false
                });

var pointerVoxelScale = 0; // this is the voxel scale used for click to add or delete
var pointerVoxelScaleSet = false; // if voxel scale has not yet been set, we use the intersection size

var pointerVoxelScaleSteps = 8; // the number of slider position steps
var pointerVoxelScaleOriginStep = 3; // the position of slider for the 1 meter size voxel
var pointerVoxelScaleMin = Math.pow(2, (1-pointerVoxelScaleOriginStep));
var pointerVoxelScaleMax = Math.pow(2, (pointerVoxelScaleSteps-pointerVoxelScaleOriginStep));
var thumbDeltaPerStep = thumbExtents / (pointerVoxelScaleSteps - 1);

function calcThumbFromScale(scale) {
    var scaleLog = Math.log(scale)/Math.log(2);
    var thumbStep = scaleLog + pointerVoxelScaleOriginStep;
    if (thumbStep < 1) {
        thumbStep = 1;
    }
    if (thumbStep > pointerVoxelScaleSteps) {
        thumbStep = pointerVoxelScaleSteps;
    }
    thumbX = (thumbDeltaPerStep * (thumbStep - 1)) + minThumbX;
    Overlays.editOverlay(thumb, { x: thumbX + sliderX } );
}

function calcScaleFromThumb(newThumbX) {
    // newThumbX is the pixel location relative to start of slider,
    // we need to figure out the actual offset in the allowed slider area
    thumbAt = newThumbX - minThumbX;
    thumbStep = Math.floor((thumbAt/ thumbExtents) * (pointerVoxelScaleSteps-1)) + 1;
    pointerVoxelScale = Math.pow(2, (thumbStep-pointerVoxelScaleOriginStep));
    // now reset the display accordingly...
    calcThumbFromScale(pointerVoxelScale);
    
    // if the user moved the thumb, then they are fixing the voxel scale
    pointerVoxelScaleSet = true;
}

function setAudioPosition() {
    var camera = Camera.getPosition();
    var forwardVector = Quat.getFront(MyAvatar.orientation);
    audioOptions.position = Vec3.sum(camera, forwardVector);
}

function getNewVoxelPosition() { 
    var camera = Camera.getPosition();
    var forwardVector = Quat.getFront(MyAvatar.orientation);
    var newPosition = Vec3.sum(camera, Vec3.multiply(forwardVector, NEW_VOXEL_DISTANCE_FROM_CAMERA));
    return newPosition;
}

function fixEulerAngles(eulers) {
    var rVal = { x: 0, y: 0, z: eulers.z };
    if (eulers.x >= 90.0) {
        rVal.x = 180.0 - eulers.x;
        rVal.y = eulers.y - 180.0;
    } else if (eulers.x <= -90.0) {
        rVal.x = 180.0 - eulers.x;
        rVal.y = eulers.y - 180.0;
    }
    return rVal;
}

var trackLastMouseX = 0;
var trackLastMouseY = 0;
var trackAsDelete = false;
var trackAsRecolor = false;
var trackAsEyedropper = false;
var trackAsOrbitOrPan = false;

var addToolSelected = true;
var deleteToolSelected = false;
var recolorToolSelected = false;
var eyedropperToolSelected = false;
var selectToolSelected = false;


function calculateVoxelFromIntersection(intersection, operation) {
    //print("calculateVoxelFromIntersection() operation="+operation);
    var resultVoxel;

    var wantDebug = false;
    if (wantDebug) {
        print(">>>>> calculateVoxelFromIntersection().... intersection voxel.red/green/blue=" + intersection.voxel.red + ", " 
                                + intersection.voxel.green + ", " + intersection.voxel.blue);
        print("   intersection voxel.x/y/z/s=" + intersection.voxel.x + ", " 
                                + intersection.voxel.y + ", " + intersection.voxel.z+ ": " + intersection.voxel.s);
        print("   intersection face=" + intersection.face);
        print("   intersection distance=" + intersection.distance);
        print("   intersection intersection.x/y/z=" + intersection.intersection.x + ", " 
                                + intersection.intersection.y + ", " + intersection.intersection.z);
    }
    
    var voxelSize;
    if (pointerVoxelScaleSet) {
        voxelSize = pointerVoxelScale; 
    } else {
        voxelSize = intersection.voxel.s; 
    }

    var x;
    var y;
    var z;
    
    // if our "target voxel size" is larger than the voxel we intersected with, then we need to find the closest
    // ancestor voxel of our target size that contains our intersected voxel.
    if (voxelSize > intersection.voxel.s) {
        if (wantDebug) {
            print("voxelSize > intersection.voxel.s.... choose the larger voxel that encompasses the one selected");
        }
        x = Math.floor(intersection.voxel.x / voxelSize) * voxelSize;
        y = Math.floor(intersection.voxel.y / voxelSize) * voxelSize;
        z = Math.floor(intersection.voxel.z / voxelSize) * voxelSize;
    } else {
        // otherwise, calculate the enclosed voxel of size voxelSize that the intersection point falls inside of.
        // if you have a voxelSize that's smaller than the voxel you're intersecting, this calculation will result
        // in the subvoxel that the intersection point falls in, if the target voxelSize matches the intersecting
        // voxel this still works and results in returning the intersecting voxel which is what we want
        var adjustToCenter = Vec3.multiply(Voxels.getFaceVector(intersection.face), (voxelSize * -0.5));
        if (wantDebug) {
            print("adjustToCenter=" + adjustToCenter.x + "," + adjustToCenter.y + "," + adjustToCenter.z);
        }
        var centerOfIntersectingVoxel = Vec3.sum(intersection.intersection, adjustToCenter);
        x = Math.floor(centerOfIntersectingVoxel.x / voxelSize) * voxelSize;
        y = Math.floor(centerOfIntersectingVoxel.y / voxelSize) * voxelSize;
        z = Math.floor(centerOfIntersectingVoxel.z / voxelSize) * voxelSize;
    }
    resultVoxel = { x: x, y: y, z: z, s: voxelSize };
    highlightAt = { x: x, y: y, z: z, s: voxelSize };

    // we only do the "add to the face we're pointing at" adjustment, if the operation is an add
    // operation, and the target voxel size is equal to or smaller than the intersecting voxel.
    var wantAddAdjust = (operation == "add" && (voxelSize <= intersection.voxel.s));
    if (wantDebug) {
        print("wantAddAdjust="+wantAddAdjust);
    }

    // now we also want to calculate the "edge square" for the face for this voxel
    if (intersection.face == "MIN_X_FACE") {

        highlightAt.x = x - zFightingSizeAdjust;
        if (wantAddAdjust) {
            resultVoxel.x -= voxelSize;
        }
        
        resultVoxel.bottomLeft = {x: highlightAt.x, y: highlightAt.y + zFightingSizeAdjust, z: highlightAt.z + zFightingSizeAdjust };
        resultVoxel.bottomRight = {x: highlightAt.x, y: highlightAt.y + zFightingSizeAdjust, z: highlightAt.z + voxelSize - zFightingSizeAdjust };
        resultVoxel.topLeft = {x: highlightAt.x, y: highlightAt.y + voxelSize - zFightingSizeAdjust, z: highlightAt.z + zFightingSizeAdjust };
        resultVoxel.topRight = {x: highlightAt.x, y: highlightAt.y + voxelSize - zFightingSizeAdjust, z: highlightAt.z + voxelSize - zFightingSizeAdjust };

    } else if (intersection.face == "MAX_X_FACE") {

        highlightAt.x = x + voxelSize + zFightingSizeAdjust;
        if (wantAddAdjust) {
            resultVoxel.x += resultVoxel.s;
        }

        resultVoxel.bottomRight = {x: highlightAt.x, y: highlightAt.y + zFightingSizeAdjust, z: highlightAt.z + zFightingSizeAdjust };
        resultVoxel.bottomLeft = {x: highlightAt.x, y: highlightAt.y + zFightingSizeAdjust, z: highlightAt.z + voxelSize - zFightingSizeAdjust };
        resultVoxel.topRight = {x: highlightAt.x, y: highlightAt.y + voxelSize - zFightingSizeAdjust, z: highlightAt.z + zFightingSizeAdjust };
        resultVoxel.topLeft = {x: highlightAt.x, y: highlightAt.y + voxelSize - zFightingSizeAdjust, z: highlightAt.z + voxelSize - zFightingSizeAdjust };

    } else if (intersection.face == "MIN_Y_FACE") {

        highlightAt.y = y - zFightingSizeAdjust;
        if (wantAddAdjust) {
            resultVoxel.y -= voxelSize;
        }
        
        resultVoxel.topRight = {x: highlightAt.x + zFightingSizeAdjust , y: highlightAt.y, z: highlightAt.z + zFightingSizeAdjust  };
        resultVoxel.topLeft = {x: highlightAt.x + voxelSize - zFightingSizeAdjust, y: highlightAt.y, z: highlightAt.z + zFightingSizeAdjust };
        resultVoxel.bottomRight = {x: highlightAt.x + zFightingSizeAdjust , y: highlightAt.y, z: highlightAt.z  + voxelSize - zFightingSizeAdjust };
        resultVoxel.bottomLeft = {x: highlightAt.x + voxelSize - zFightingSizeAdjust , y: highlightAt.y, z: highlightAt.z + voxelSize - zFightingSizeAdjust };

    } else if (intersection.face == "MAX_Y_FACE") {

        highlightAt.y = y + voxelSize + zFightingSizeAdjust;
        if (wantAddAdjust) {
            resultVoxel.y += voxelSize;
        }
        
        resultVoxel.bottomRight = {x: highlightAt.x + zFightingSizeAdjust, y: highlightAt.y, z: highlightAt.z + zFightingSizeAdjust };
        resultVoxel.bottomLeft = {x: highlightAt.x + voxelSize - zFightingSizeAdjust, y: highlightAt.y, z: highlightAt.z + zFightingSizeAdjust};
        resultVoxel.topRight = {x: highlightAt.x + zFightingSizeAdjust, y: highlightAt.y, z: highlightAt.z  + voxelSize - zFightingSizeAdjust};
        resultVoxel.topLeft = {x: highlightAt.x + voxelSize - zFightingSizeAdjust, y: highlightAt.y, z: highlightAt.z + voxelSize - zFightingSizeAdjust};

    } else if (intersection.face == "MIN_Z_FACE") {

        highlightAt.z = z - zFightingSizeAdjust;
        if (wantAddAdjust) {
            resultVoxel.z -= voxelSize;
        }
        
        resultVoxel.bottomRight = {x: highlightAt.x + zFightingSizeAdjust, y: highlightAt.y + zFightingSizeAdjust, z: highlightAt.z };
        resultVoxel.bottomLeft = {x: highlightAt.x + voxelSize - zFightingSizeAdjust, y: highlightAt.y + zFightingSizeAdjust, z: highlightAt.z};
        resultVoxel.topRight = {x: highlightAt.x + zFightingSizeAdjust, y: highlightAt.y + voxelSize - zFightingSizeAdjust, z: highlightAt.z };
        resultVoxel.topLeft = {x: highlightAt.x + voxelSize - zFightingSizeAdjust, y: highlightAt.y + voxelSize - zFightingSizeAdjust, z: highlightAt.z};

    } else if (intersection.face == "MAX_Z_FACE") {

        highlightAt.z = z + voxelSize + zFightingSizeAdjust;
        if (wantAddAdjust) {
            resultVoxel.z += voxelSize;
        }

        resultVoxel.bottomLeft = {x: highlightAt.x + zFightingSizeAdjust, y: highlightAt.y + zFightingSizeAdjust, z: highlightAt.z };
        resultVoxel.bottomRight = {x: highlightAt.x + voxelSize - zFightingSizeAdjust, y: highlightAt.y + zFightingSizeAdjust, z: highlightAt.z};
        resultVoxel.topLeft = {x: highlightAt.x + zFightingSizeAdjust, y: highlightAt.y + voxelSize - zFightingSizeAdjust, z: highlightAt.z };
        resultVoxel.topRight = {x: highlightAt.x + voxelSize - zFightingSizeAdjust, y: highlightAt.y + voxelSize - zFightingSizeAdjust, z: highlightAt.z};

    }
    
    return resultVoxel;
}

function showPreviewVoxel() {
    var voxelColor;

    var pickRay = Camera.computePickRay(trackLastMouseX, trackLastMouseY);
    var intersection = Voxels.findRayIntersection(pickRay);

    // if the user hasn't updated the 
    if (!pointerVoxelScaleSet) {
        calcThumbFromScale(intersection.voxel.s);
    }

    if (whichColor == -1) {
        //  Copy mode - use clicked voxel color
        voxelColor = { red: intersection.voxel.red,
                  green: intersection.voxel.green,
                  blue: intersection.voxel.blue };
    } else {
        voxelColor = { red: colors[whichColor].red,
                  green: colors[whichColor].green,
                  blue: colors[whichColor].blue };
    }

    var guidePosition;
    
    if (trackAsDelete || deleteToolSelected) {
        guidePosition = calculateVoxelFromIntersection(intersection,"delete");
        Overlays.editOverlay(voxelPreview, { 
                position: guidePosition,
                size: guidePosition.s + zFightingSizeAdjust,
                visible: true,
                color: { red: 255, green: 0, blue: 0 },
                solid: false,
                alpha: 1
            });
    } else if (selectToolSelected) {
        guidePosition = calculateVoxelFromIntersection(intersection,"select");
        Overlays.editOverlay(voxelPreview, { 
                position: guidePosition,
                size: guidePosition.s + zFightingSizeAdjust,
                visible: true,
                color: { red: 255, green: 255, blue: 0 },
                solid: false,
                alpha: 1
            });
    } else if (trackAsRecolor || recolorToolSelected || trackAsEyedropper|| eyedropperToolSelected) {
        guidePosition = calculateVoxelFromIntersection(intersection,"recolor");

        Overlays.editOverlay(voxelPreview, { 
                position: guidePosition,
                size: guidePosition.s + zFightingSizeAdjust,
                visible: true,
                color: voxelColor,
                solid: true,
                alpha: 0.8
            });
    } else if (trackAsOrbitOrPan) {
        Overlays.editOverlay(voxelPreview, { visible: false });
    } else if (addToolSelected && !isExtruding) {
        guidePosition = calculateVoxelFromIntersection(intersection,"add");

        Overlays.editOverlay(voxelPreview, { 
                position: guidePosition,
                size: (guidePosition.s - zFightingSizeAdjust),
                visible: true,
                color: voxelColor,
                solid: true,
                alpha: 0.7
            });
    } else if (isExtruding) {
        Overlays.editOverlay(voxelPreview, { visible: false });
    }
}

function showPreviewLines() {

    var pickRay = Camera.computePickRay(trackLastMouseX, trackLastMouseY);
    var intersection = Voxels.findRayIntersection(pickRay);
    
    if (intersection.intersects) {

        // if the user hasn't updated the 
        if (!pointerVoxelScaleSet) {
            calcThumbFromScale(intersection.voxel.s);
        }

        resultVoxel = calculateVoxelFromIntersection(intersection,"");
        if (selectToolSelected) {
            Overlays.editOverlay(voxelPreview, { 
                    position: resultVoxel,
                    size: resultVoxel.s + zFightingSizeAdjust,
                    visible: true,
                    color: { red: 255, green: 255, blue: 0 },
                    lineWidth: previewLineWidth,
                    solid: false,
                    alpha: 1
                });
        } else {
            Overlays.editOverlay(voxelPreview, { visible: false });
            Overlays.editOverlay(linePreviewTop, { position: resultVoxel.topLeft, end: resultVoxel.topRight, visible: true });
            Overlays.editOverlay(linePreviewBottom, { position: resultVoxel.bottomLeft, end: resultVoxel.bottomRight, visible: true });
            Overlays.editOverlay(linePreviewLeft, { position: resultVoxel.topLeft, end: resultVoxel.bottomLeft, visible: true });
            Overlays.editOverlay(linePreviewRight, { position: resultVoxel.topRight, end: resultVoxel.bottomRight, visible: true });
        }
    } else {
        Overlays.editOverlay(voxelPreview, { visible: false });
        Overlays.editOverlay(linePreviewTop, { visible: false });
        Overlays.editOverlay(linePreviewBottom, { visible: false });
        Overlays.editOverlay(linePreviewLeft, { visible: false });
        Overlays.editOverlay(linePreviewRight, { visible: false });
    }
}

function showPreviewGuides() {
    if (editToolsOn) {
        if (previewAsVoxel) {
            showPreviewVoxel();

            // make sure alternative is hidden
            Overlays.editOverlay(linePreviewTop, { visible: false });
            Overlays.editOverlay(linePreviewBottom, { visible: false });
            Overlays.editOverlay(linePreviewLeft, { visible: false });
            Overlays.editOverlay(linePreviewRight, { visible: false });
        } else {
            showPreviewLines();
        }
    } else {
        // make sure all previews are off
        Overlays.editOverlay(voxelPreview, { visible: false });
        Overlays.editOverlay(linePreviewTop, { visible: false });
        Overlays.editOverlay(linePreviewBottom, { visible: false });
        Overlays.editOverlay(linePreviewLeft, { visible: false });
        Overlays.editOverlay(linePreviewRight, { visible: false });
    }
}

function trackMouseEvent(event) {
    if (!trackAsOrbitOrPan) {
        trackLastMouseX = event.x;
        trackLastMouseY = event.y;
        trackAsDelete = event.isControl;
        trackAsRecolor = event.isShifted;
        trackAsEyedropper = event.isMeta;
        trackAsOrbitOrPan = event.isAlt; // TODO: double check this...??
        showPreviewGuides();
    }
}

function trackKeyPressEvent(event) {
    if (!editToolsOn) {
        return;
    }

    if (event.text == "CONTROL") {
        trackAsDelete = true;
        moveTools();
    }
    if (event.text == "SHIFT") {
        trackAsRecolor = true;
        moveTools();
    }
    if (event.text == "META") {
        trackAsEyedropper = true;
        moveTools();
    }
    if (event.text == "ALT") {
        trackAsOrbitOrPan = true;
        moveTools();
    }
    showPreviewGuides();
}

function trackKeyReleaseEvent(event) {
    // on TAB release, toggle our tool state
    if (event.text == "TAB") {
        editToolsOn = !editToolsOn;
        moveTools();
        Audio.playSound(clickSound, audioOptions);
    }

    if (editToolsOn) {
        if (event.text == "ESC") {
            pointerVoxelScaleSet = false;
        }
        if (event.text == "-") {
            thumbX -= thumbDeltaPerStep;
            calcScaleFromThumb(thumbX);
        }
        if (event.text == "+") {
            thumbX += thumbDeltaPerStep;
            calcScaleFromThumb(thumbX);
        }
        if (event.text == "CONTROL") {
            trackAsDelete = false;
            moveTools();
        }
        if (event.text == "SHIFT") {
            trackAsRecolor = false;
            moveTools();
        }
        if (event.text == "META") {
            trackAsEyedropper = false;
            moveTools();
        }
        if (event.text == "ALT") {
            trackAsOrbitOrPan = false;
            moveTools();
        }
        
        // on F1 toggle the preview mode between cubes and lines
        if (event.text == "F1") {
            previewAsVoxel = !previewAsVoxel;
        }

        showPreviewGuides();
    }    
}

function startOrbitMode(event) {
    mouseX = event.x;
    mouseY = event.y;
    var pickRay = Camera.computePickRay(event.x, event.y);
    var intersection = Voxels.findRayIntersection(pickRay);

    // start orbit camera! 
    var cameraPosition = Camera.getPosition();
    oldMode = Camera.getMode();
    Camera.setMode("independent");
    Camera.keepLookingAt(intersection.intersection);
    // get position for initial azimuth, elevation
    orbitCenter = intersection.intersection; 
    var orbitVector = Vec3.subtract(cameraPosition, orbitCenter);
    orbitRadius = Vec3.length(orbitVector); 
    orbitAzimuth = Math.atan2(orbitVector.z, orbitVector.x);
    orbitAltitude = Math.asin(orbitVector.y / Vec3.length(orbitVector));
    
    //print("startOrbitMode...");
}

function handleOrbitingMove(event) {
    var cameraOrientation = Camera.getOrientation();
    var origEulers = Quat.safeEulerAngles(cameraOrientation);
    var newEulers = fixEulerAngles(Quat.safeEulerAngles(cameraOrientation));
    var dx = event.x - mouseX; 
    var dy = event.y - mouseY;
    orbitAzimuth += dx / ORBIT_RATE_AZIMUTH;
    orbitAltitude += dy / ORBIT_RATE_ALTITUDE;
     var orbitVector = { x:(Math.cos(orbitAltitude) * Math.cos(orbitAzimuth)) * orbitRadius, 
                        y:Math.sin(orbitAltitude) * orbitRadius,
                        z:(Math.cos(orbitAltitude) * Math.sin(orbitAzimuth)) * orbitRadius }; 
    orbitPosition = Vec3.sum(orbitCenter, orbitVector);
    Camera.setPosition(orbitPosition);
    mouseX = event.x; 
    mouseY = event.y;
    //print("handleOrbitingMove...");
}

function endOrbitMode(event) {
    var cameraOrientation = Camera.getOrientation();
    MyAvatar.position = Camera.getPosition();
    MyAvatar.headOrientation = cameraOrientation;
    Camera.stopLooking();
    Camera.setMode(oldMode);
    Camera.setOrientation(cameraOrientation);
    //print("endOrbitMode...");
}

function startPanMode(event, intersection) {
    // start pan camera! 
    print("handle PAN mode!!!");
}

function handlePanMove(event) {
    print("PANNING mode!!! ");
    //print("isPanning="+isPanning + " inPanningFromTouch="+isPanningFromTouch + " trackAsOrbitOrPan="+trackAsOrbitOrPan);
}

function endPanMode(event) {
    print("ending PAN mode!!!");
}


function mousePressEvent(event) {

    // if our tools are off, then don't do anything
    if (!editToolsOn) {
        return; 
    }
    
    // Normally, if we're panning or orbiting from touch, ignore these... because our touch takes precedence. 
    // but In the case of a button="RIGHT" click, we may get some touch messages first, and we actually want to 
    // cancel any touch mode, and then let the right-click through
    if (isOrbitingFromTouch || isPanningFromTouch) {
    
        // if the user is holding the ALT key AND they are clicking the RIGHT button (or on multi-touch doing a two
        // finger touch, then we want to let the new panning behavior take over.
        // if it's any other case we still want to bail
        if (event.button == "RIGHT" && trackAsOrbitOrPan) {
            // cancel our current multitouch operation...
            if (isOrbitingFromTouch) {
                endOrbitMode(event);
                isOrbitingFromTouch = false;
            }
            if (isPanningFromTouch) {
                //print("mousePressEvent... calling endPanMode()");
                endPanMode(event);
                isPanningFromTouch = false;
            }
            // let things fall through
        } else {
            return; 
        }
    }
    
    // no clicking on overlays while in panning mode
    if (!trackAsOrbitOrPan) {
        var clickedOnSomething = false;
        var clickedOverlay = Overlays.getOverlayAtPoint({x: event.x, y: event.y});
        
print("clickedOverlay="+clickedOverlay);        

        // If the user clicked on the thumb, handle the slider logic
        if (clickedOverlay == thumb) {
            isMovingSlider = true;
            thumbClickOffsetX = event.x - (sliderX + thumbX); // this should be the position of the mouse relative to the thumb
            clickedOnSomething = true;
        } else if (clickedOverlay == addTool) {
            addToolSelected = true;
            deleteToolSelected = false;
            recolorToolSelected = false;
            eyedropperToolSelected = false;
            selectToolSelected = false;
            moveTools();
            clickedOnSomething = true;
        } else if (clickedOverlay == deleteTool) {
            addToolSelected = false;
            deleteToolSelected = true;
            recolorToolSelected = false;
            eyedropperToolSelected = false;
            selectToolSelected = false;
            moveTools();
            clickedOnSomething = true;
        } else if (clickedOverlay == recolorTool) {
            addToolSelected = false;
            deleteToolSelected = false;
            recolorToolSelected = true;
            eyedropperToolSelected = false;
            selectToolSelected = false;
            moveTools();
            clickedOnSomething = true;
        } else if (clickedOverlay == eyedropperTool) {
            addToolSelected = false;
            deleteToolSelected = false;
            recolorToolSelected = false;
            eyedropperToolSelected = true;
            selectToolSelected = false;
            moveTools();
            clickedOnSomething = true;
        } else if (clickedOverlay == selectTool) {
            addToolSelected = false;
            deleteToolSelected = false;
            recolorToolSelected = false;
            eyedropperToolSelected = false;
            selectToolSelected = true;
            moveTools();
            clickedOnSomething = true;
        } else {
            // if the user clicked on one of the color swatches, update the selectedSwatch
            for (s = 0; s < numColors; s++) {
                if (clickedOverlay == swatches[s]) {
                    whichColor = s;
                    moveTools();
                    clickedOnSomething = true;
                    break;
                }
            }
        }
        if (clickedOnSomething) {
            return; // no further processing
        }
    }
    
    // TODO: does any of this stuff need to execute if we're panning or orbiting?
    trackMouseEvent(event); // used by preview support
    mouseX = event.x;
    mouseY = event.y;
    var pickRay = Camera.computePickRay(event.x, event.y);
    var intersection = Voxels.findRayIntersection(pickRay);
    audioOptions.position = Vec3.sum(pickRay.origin, pickRay.direction);
    if (intersection.intersects) {
        // if the user hasn't updated the 
        if (!pointerVoxelScaleSet) {
            calcThumbFromScale(intersection.voxel.s);
        }
        
        // Note: touch and mouse events can cross paths, so we want to ignore any mouse events that would
        // start a pan or orbit if we're already doing a pan or orbit via touch...
        if ((event.isAlt || trackAsOrbitOrPan) && !(isOrbitingFromTouch || isPanningFromTouch)) {
            if (event.isLeftButton && !event.isRightButton) {
                startOrbitMode(event);
                isOrbiting = true;
            } else if (event.isRightButton && !event.isLeftButton) {
                startPanMode(event);
                isPanning = true;
            }
        } else if (deleteToolSelected || trackAsDelete || (event.isRightButton && !trackAsEyedropper)) {
            //  Delete voxel
            voxelDetails = calculateVoxelFromIntersection(intersection,"delete");
            Voxels.eraseVoxel(voxelDetails.x, voxelDetails.y, voxelDetails.z, voxelDetails.s);
            Audio.playSound(deleteSound, audioOptions);
            Overlays.editOverlay(voxelPreview, { visible: false });
        } else if (eyedropperToolSelected || trackAsEyedropper) {
            if (whichColor != -1) {
                colors[whichColor].red = intersection.voxel.red;
                colors[whichColor].green = intersection.voxel.green;
                colors[whichColor].blue = intersection.voxel.blue;
                moveTools();
            }
            
        } else if (recolorToolSelected || trackAsRecolor) {
            //  Recolor Voxel
            voxelDetails = calculateVoxelFromIntersection(intersection,"recolor");

            // doing this erase then set will make sure we only recolor just the target voxel
            Voxels.eraseVoxel(voxelDetails.x, voxelDetails.y, voxelDetails.z, voxelDetails.s);
            Voxels.setVoxel(voxelDetails.x, voxelDetails.y, voxelDetails.z, voxelDetails.s, 
                            colors[whichColor].red, colors[whichColor].green, colors[whichColor].blue);
            Audio.playSound(changeColorSound, audioOptions);
            Overlays.editOverlay(voxelPreview, { visible: false });
        } else if (addToolSelected) {
            //  Add voxel on face
            if (whichColor == -1) {
                //  Copy mode - use clicked voxel color
                newColor = {    
                    red: intersection.voxel.red,
                    green: intersection.voxel.green,
                    blue: intersection.voxel.blue };
            } else {
                newColor = {    
                    red: colors[whichColor].red,
                    green: colors[whichColor].green,
                    blue: colors[whichColor].blue };
            }
                    
            voxelDetails = calculateVoxelFromIntersection(intersection,"add");
            Voxels.eraseVoxel(voxelDetails.x, voxelDetails.y, voxelDetails.z, voxelDetails.s);
            Voxels.setVoxel(voxelDetails.x, voxelDetails.y, voxelDetails.z, voxelDetails.s,
                newColor.red, newColor.green, newColor.blue);
            lastVoxelPosition = { x: voxelDetails.x, y: voxelDetails.y, z: voxelDetails.z };
            lastVoxelColor = { red: newColor.red, green: newColor.green, blue: newColor.blue };
            lastVoxelScale = voxelDetails.s;

            Audio.playSound(addSound, audioOptions);
            Overlays.editOverlay(voxelPreview, { visible: false });
            dragStart = { x: event.x, y: event.y };
            isAdding = true;
        } 
    }
}

function keyPressEvent(event) {
    // if our tools are off, then don't do anything
    if (editToolsOn) {
        var nVal = parseInt(event.text);
        if (event.text == "0") {
            print("Color = Copy");
            whichColor = -1;
            Audio.playSound(clickSound, audioOptions);
            moveTools();
        } else if ((nVal > 0) && (nVal <= numColors)) {
            whichColor = nVal - 1;
            print("Color = " + (whichColor + 1));
            Audio.playSound(clickSound, audioOptions);
            moveTools();
        } else if (event.text == "9") {
            // Create a brand new 1 meter voxel in front of your avatar 
            var color = whichColor; 
            if (color == -1) color = 0;
            var newPosition = getNewVoxelPosition();
            var newVoxel = {    
                        x: newPosition.x,
                        y: newPosition.y ,
                        z: newPosition.z,    
                        s: NEW_VOXEL_SIZE,
                        red: colors[color].red,
                        green: colors[color].green,
                        blue: colors[color].blue };
            Voxels.eraseVoxel(voxelDetails.x, voxelDetails.y, voxelDetails.z, voxelDetails.s);
            Voxels.setVoxel(newVoxel.x, newVoxel.y, newVoxel.z, newVoxel.s, newVoxel.red, newVoxel.green, newVoxel.blue);
            setAudioPosition();
            Audio.playSound(addSound, audioOptions);
        }
    }
    
    // do this even if not in edit tools
    if (event.text == " ") {
        //  Reset my orientation!
        var orientation = { x:0, y:0, z:0, w:1 };
        Camera.setOrientation(orientation);
        MyAvatar.orientation = orientation;
    }
    trackKeyPressEvent(event); // used by preview support
}

function keyReleaseEvent(event) {
    trackKeyReleaseEvent(event); // used by preview support

    // handle clipboard items
    if (selectToolSelected) {
        var pickRay = Camera.computePickRay(trackLastMouseX, trackLastMouseY);
        var intersection = Voxels.findRayIntersection(pickRay);
        selectedVoxel = calculateVoxelFromIntersection(intersection,"select");
    
        // Note: this sample uses Alt+ as the key codes for these clipboard items
        if ((event.key == 199 || event.key == 67 || event.text == "C" || event.text == "c") && event.isAlt) {
            print("the Alt+C key was pressed... copy");
            Clipboard.copyVoxel(selectedVoxel.x, selectedVoxel.y, selectedVoxel.z, selectedVoxel.s);
        }
        if ((event.key == 8776 || event.key == 88 || event.text == "X" || event.text == "x") && event.isAlt) {
            print("the Alt+X key was pressed... cut");
            Clipboard.cutVoxel(selectedVoxel.x, selectedVoxel.y, selectedVoxel.z, selectedVoxel.s);
        }
        if ((event.key == 8730 || event.key == 86 || event.text == "V" || event.text == "v") && event.isAlt) {
            print("the Alt+V key was pressed... paste");
            Clipboard.pasteVoxel(selectedVoxel.x, selectedVoxel.y, selectedVoxel.z, selectedVoxel.s);
        }
        if (event.text == "DELETE" || event.text == "BACKSPACE") {
            print("the DELETE/BACKSPACE key was pressed... delete");
            Clipboard.deleteVoxel(selectedVoxel.x, selectedVoxel.y, selectedVoxel.z, selectedVoxel.s);
        }
    
        if ((event.text == "E" || event.text == "e") && event.isMeta) {
            print("the Ctl+E key was pressed... export");
            Clipboard.exportVoxel(selectedVoxel.x, selectedVoxel.y, selectedVoxel.z, selectedVoxel.s);
        }
        if ((event.text == "I" || event.text == "i") && event.isMeta) {
            print("the Ctl+I key was pressed... import");
            Clipboard.importVoxels();
        }
        if ((event.key == 78 || event.text == "N" || event.text == "n") && event.isMeta) {
            print("the Ctl+N key was pressed, nudging to left 1 meter... nudge");
            Clipboard.nudgeVoxel(selectedVoxel.x, selectedVoxel.y, selectedVoxel.z, selectedVoxel.s, { x: -1, y: 0, z: 0 });
        }
    }
}


function mouseMoveEvent(event) {
    if (!editToolsOn) {
        return;
    }

    // if we're panning or orbiting from touch, ignore these... because our touch takes precedence. 
    if (isOrbitingFromTouch || isPanningFromTouch) {
        return; 
    }
    
    // double check that we didn't accidentally miss a pan or orbit click request
    if (trackAsOrbitOrPan && !isPanning && !isOrbiting) {
        if (event.isLeftButton && !event.isRightButton) {
            startOrbitMode(event);
            isOrbiting = true;
        }
        if (!event.isLeftButton && event.isRightButton) {
            startPanMode(event);
            isPanning = true;
        }
    }

    if (!trackAsOrbitOrPan && isMovingSlider) {
        thumbX = (event.x - thumbClickOffsetX) - sliderX;
        if (thumbX < minThumbX) {
            thumbX = minThumbX;
        }
        if (thumbX > maxThumbX) {
            thumbX = maxThumbX;
        }
        calcScaleFromThumb(thumbX);
        
    } else if (isOrbiting) {
        handleOrbitingMove(event);
    } else if (isPanning) {
        handlePanMove(event);
    } else if (!trackAsOrbitOrPan && isAdding) {
        //  Watch the drag direction to tell which way to 'extrude' this voxel
        if (!isExtruding) {
            var pickRay = Camera.computePickRay(event.x, event.y);
            var lastVoxelDistance = { x: pickRay.origin.x - lastVoxelPosition.x, 
                                    y: pickRay.origin.y - lastVoxelPosition.y, 
                                    z: pickRay.origin.z - lastVoxelPosition.z };
            var distance = Vec3.length(lastVoxelDistance);
            var mouseSpot = { x: pickRay.direction.x * distance, y: pickRay.direction.y * distance, z: pickRay.direction.z * distance };
            mouseSpot.x += pickRay.origin.x;
            mouseSpot.y += pickRay.origin.y;
            mouseSpot.z += pickRay.origin.z;
            var dx = mouseSpot.x - lastVoxelPosition.x;
            var dy = mouseSpot.y - lastVoxelPosition.y;
            var dz = mouseSpot.z - lastVoxelPosition.z;
            extrudeScale = lastVoxelScale;
            extrudeDirection = { x: 0, y: 0, z: 0 };
            isExtruding = true;
            if (dx > lastVoxelScale) extrudeDirection.x = extrudeScale;
            else if (dx < -lastVoxelScale) extrudeDirection.x = -extrudeScale;
            else if (dy > lastVoxelScale) extrudeDirection.y = extrudeScale;
            else if (dy < -lastVoxelScale) extrudeDirection.y = -extrudeScale;
            else if (dz > lastVoxelScale) extrudeDirection.z = extrudeScale;
            else if (dz < -lastVoxelScale) extrudeDirection.z = -extrudeScale;
            else isExtruding = false; 
        } else {
            //  We have got an extrusion direction, now look for mouse move beyond threshold to add new voxel
            var dx = event.x - mouseX; 
            var dy = event.y - mouseY;
            if (Math.sqrt(dx*dx + dy*dy) > PIXELS_PER_EXTRUDE_VOXEL)  {
                lastVoxelPosition = Vec3.sum(lastVoxelPosition, extrudeDirection);
                Voxels.eraseVoxel(voxelDetails.x, voxelDetails.y, voxelDetails.z, voxelDetails.s);
                Voxels.setVoxel(lastVoxelPosition.x, lastVoxelPosition.y, lastVoxelPosition.z, 
                            extrudeScale, lastVoxelColor.red, lastVoxelColor.green, lastVoxelColor.blue);
                mouseX = event.x;
                mouseY = event.y;
            }
        }
    }
    
    // update the add voxel/delete voxel overlay preview
    trackMouseEvent(event);
}

function mouseReleaseEvent(event) {
    // if our tools are off, then don't do anything
    if (!editToolsOn) {
        return; 
    }

    if (isMovingSlider) {
        isMovingSlider = false;
    }
    
    if (isOrbiting) {
        endOrbitMode(event);
        isOrbiting = false;
    }
    if (isPanning) {
        print("mouseReleaseEvent... calling endPanMode()");
        endPanMode(event);
        isPanning = false;
    }
    isAdding = false;
    isExtruding = false; 
}

function moveTools() {
    // move the swatches
    swatchesX = (windowDimensions.x - (swatchesWidth + sliderWidth)) / 2;
    swatchesY = windowDimensions.y - swatchHeight;

    // create the overlays, position them in a row, set their colors, and for the selected one, use a different source image
    // location so that it displays the "selected" marker
    for (s = 0; s < numColors; s++) {
        var imageFromX = 12 + (s * 27);
        var imageFromY = 0;
        if (s == whichColor) {
            imageFromY = 55;
        }
        var swatchX = swatchesX + ((swatchWidth - 1) * s);

        Overlays.editOverlay(swatches[s], {
                        x: swatchX,
                        y: swatchesY,
                        subImage: { x: imageFromX, y: imageFromY, width: (swatchWidth - 1), height: swatchHeight },
                        color: colors[s],
                        alpha: 1,
                        visible: editToolsOn
                    });
    }

    // move the tools
    toolsY = (windowDimensions.y - toolsHeight) / 2;
    addToolColor = notSelectedColor;
    deleteToolColor = notSelectedColor;
    recolorToolColor = notSelectedColor;
    eyedropperToolColor = notSelectedColor;
    selectToolColor = notSelectedColor;

    if (trackAsDelete || deleteToolSelected) {
        deleteToolColor = toolSelectedColor;
    } else if (trackAsRecolor || recolorToolSelected) {
        recolorToolColor = toolSelectedColor;
    } else if (trackAsEyedropper || eyedropperToolSelected) {
        eyedropperToolColor = toolSelectedColor;
    } else if (selectToolSelected) {
        selectToolColor = toolSelectedColor;
    } else if (trackAsOrbitOrPan) {
        // nothing gets selected in this case...
    } else {
        addToolColor = toolSelectedColor;
    }

    Overlays.editOverlay(addTool, {
                    x: 0, y: toolsY + (toolHeight * addToolAt), width: toolWidth, height: toolHeight,
                    color: addToolColor,
                    visible: editToolsOn
                });

    Overlays.editOverlay(deleteTool, {
                    x: 0, y: toolsY + (toolHeight * deleteToolAt), width: toolWidth, height: toolHeight,
                    color: deleteToolColor,
                    visible: editToolsOn
                });

    Overlays.editOverlay(recolorTool, {
                    x: 0, y: toolsY + (toolHeight * recolorToolAt), width: toolWidth, height: toolHeight,
                    color: recolorToolColor,
                    visible: editToolsOn
                });

    Overlays.editOverlay(eyedropperTool, {
                    x: 0, y: toolsY + (toolHeight * eyedropperToolAt), width: toolWidth, height: toolHeight,
                    color: eyedropperToolColor,
                    visible: editToolsOn
                });

    Overlays.editOverlay(selectTool, {
                    x: 0, y: toolsY + (toolHeight * selectToolAt), width: toolWidth, height: toolHeight,
                    color: selectToolColor,
                    visible: editToolsOn
                });

    sliderX = swatchesX + swatchesWidth;
    sliderY = windowDimensions.y - sliderHeight;
    Overlays.editOverlay(slider, { x: sliderX, y: sliderY, visible: editToolsOn });

    // This is the thumb of our slider
    thumbY = sliderY + 9;
    Overlays.editOverlay(thumb, { x: sliderX + thumbX, y: thumbY, visible: editToolsOn });

}

function touchBeginEvent(event) {
    if (!editToolsOn) {
        return;
    }
    
    // if we're already in the middle of orbiting or panning, then ignore these multi-touch events...
    if (isOrbiting || isPanning) {
        return;
    }    
    
    if (event.isAlt || trackAsOrbitOrPan) {
        if (event.touchPoints == touchPointsToOrbit) {
            // we need to double check that we didn't start an orbit, because the touch events will sometimes
            // come in as 2 then 3 touches... 
            if (isPanningFromTouch) {
                print("touchBeginEvent... calling endPanMode()");
                endPanMode(event);
                isPanningFromTouch = false;
            }
            startOrbitMode(event);
            isOrbitingFromTouch = true;
        } else if (event.touchPoints == touchPointsToPan) {
            // we need to double check that we didn't start an orbit, because the touch events will sometimes
            // come in as 2 then 3 touches... 
            if (isOrbitingFromTouch) {
                endOrbitMode(event);
                isOrbitingFromTouch = false;
            }
            startPanMode(event);
            isPanningFromTouch = true;
        }
    }
}

function touchUpdateEvent(event) {
    if (!editToolsOn) {
        return;
    }

    // if we're already in the middle of orbiting or panning, then ignore these multi-touch events...
    if (isOrbiting || isPanning) {
        return;
    }    
    
    if (isOrbitingFromTouch) {
        // we need to double check that we didn't start an orbit, because the touch events will sometimes
        // come in as 2 then 3 touches... 
        if (event.touchPoints == touchPointsToPan) {
            //print("we now have touchPointsToPan touches... switch to pan...");
            endOrbitMode(event);
            isOrbitingFromTouch = false;
            startPanMode(event);
            isPanningFromTouch = true;
        } else {
            handleOrbitingMove(event);
        }
    }
    if (isPanningFromTouch) {
        //print("touchUpdateEvent... isPanningFromTouch... event.touchPoints=" + event.touchPoints);
        // we need to double check that we didn't start an orbit, because the touch events will sometimes
        // come in as 2 then 3 touches... 
        if (event.touchPoints == touchPointsToOrbit) {
            //print("we now have touchPointsToOrbit touches... switch to orbit...");
            //print("touchUpdateEvent... calling endPanMode()");
            endPanMode(event);
            isPanningFromTouch = false;
            startOrbitMode(event);
            isOrbitingFromTouch = true;
            handleOrbitingMove(event);
        } else {
            handlePanMove(event);
        }
    }
}

function touchEndEvent(event) {
    if (!editToolsOn) {
        return;
    }

    // if we're already in the middle of orbiting or panning, then ignore these multi-touch events...
    if (isOrbiting || isPanning) {
        return;
    }    
    
    if (isOrbitingFromTouch) {
        endOrbitMode(event);
        isOrbitingFromTouch = false;
    }
    if (isPanningFromTouch) {
        print("touchEndEvent... calling endPanMode()");
        endPanMode(event);
        isPanningFromTouch = false;
    }
}

function update() {
    var newWindowDimensions = Controller.getViewportDimensions();
    if (newWindowDimensions.x != windowDimensions.x || newWindowDimensions.y != windowDimensions.y) {
        windowDimensions = newWindowDimensions;
        moveTools();
    }
}

Controller.mousePressEvent.connect(mousePressEvent);
Controller.mouseReleaseEvent.connect(mouseReleaseEvent);
Controller.mouseMoveEvent.connect(mouseMoveEvent);
Controller.keyPressEvent.connect(keyPressEvent);
Controller.keyReleaseEvent.connect(keyReleaseEvent);
Controller.touchBeginEvent.connect(touchBeginEvent);
Controller.touchUpdateEvent.connect(touchUpdateEvent);
Controller.touchEndEvent.connect(touchEndEvent);
Controller.captureKeyEvents({ text: "+" });
Controller.captureKeyEvents({ text: "-" });


function scriptEnding() {
    Overlays.deleteOverlay(voxelPreview);
    Overlays.deleteOverlay(linePreviewTop);
    Overlays.deleteOverlay(linePreviewBottom);
    Overlays.deleteOverlay(linePreviewLeft);
    Overlays.deleteOverlay(linePreviewRight);
    for (s = 0; s < numColors; s++) {
        Overlays.deleteOverlay(swatches[s]);
    }
    Overlays.deleteOverlay(addTool);
    Overlays.deleteOverlay(deleteTool);
    Overlays.deleteOverlay(recolorTool);
    Overlays.deleteOverlay(eyedropperTool);
    Overlays.deleteOverlay(selectTool);
    Overlays.deleteOverlay(slider);
    Overlays.deleteOverlay(thumb);
    Controller.releaseKeyEvents({ text: "+" });
    Controller.releaseKeyEvents({ text: "-" });
}
Script.scriptEnding.connect(scriptEnding);


Script.willSendVisualDataCallback.connect(update);



