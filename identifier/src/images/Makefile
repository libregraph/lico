# Tools

# ImageMagick 7 renamed the entry point to "magick" and only some distributions
# still ship a "convert" wrapper, so prefer the new name and fall back. This is
# a recursively expanded assignment on purpose: the lookup then runs only when
# the icons target below actually uses it, not on every make invocation.
CONVERT   ?= $(shell command -v magick 2>/dev/null || echo convert)
RSVG      ?= rsvg-convert

# Variables

STATIC ?= ../../public/static
ICON   ?= lico-icon.svg

# Build

all: app-icon.svg

.PHONY: icons
icons: $(STATIC)/favicon.ico

.PHONY: $(STATIC)/favicon.ico
$(STATIC)/favicon.ico: app-icon-rounded-256x256.png
	$(CONVERT) -background transparent $< -define icon:auto-resize=16,32,48,64,128,256 $@

app-icon.svg: $(ICON)
	cp -vaf $< $@

# The icon declares only a viewBox and no intrinsic size, so the raster size has
# to be stated outright. 205 is 80% of 256, leaving the margin the rounded
# corners are cut from.
app-icon-whitebox-256x256.png: app-icon.svg
	$(RSVG) -w 205 -h 205 -b white $< -o $@.tmp
	$(CONVERT) $@.tmp -background white -gravity center -extent 256x256 $@
	@$(RM) $@.tmp

app-icon-rounded-256x256.png: app-icon-whitebox-256x256.png
	$(CONVERT) -size 256x256 xc:none -draw "roundrectangle 2,2,252,252,126,126" $@.tmp.png
	$(CONVERT) $< -alpha set $@.tmp.png -compose DstIn -composite $@
	@$(RM) $@.tmp.png

.PHONY: clean
clean:
	$(RM) app-icon-*.png || true
	$(RM) app-icon.svg || true
