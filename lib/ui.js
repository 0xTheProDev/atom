"use strict";

const {CompositeDisposable, Disposable, Emitter} = require("atom");


class UI {
	
	init(){
		this.lightTheme  = false;
		this.treeView    = null;
		this.disposables = new CompositeDisposable();
		this.emitter     = new Emitter();
		
		this.checkPanes();
		this.disposables.add(
			atom.themes.onDidChangeActiveThemes(_=> {
				this.checkMotif();
				this.fixOffset();
			}),
			
			atom.packages.onDidActivatePackage(_=> this.checkPanes()),
			atom.packages.onDidDeactivatePackage(_=> this.checkPanes()),
			atom.packages.onDidActivateInitialPackages(_=> this.checkPanes())
		);
	}
	
	
	reset(){
		this.disposables.dispose();
		this.disposables = null;
		this.emitter.dispose();
		this.emitter = null;
	}


	onTreeViewAdded(fn){
		return this.emitter.on("tree-view-added", fn);
	}
	
	onTreeViewRemoved(fn){
		return this.emitter.on("tree-view-removed", fn);
	}
	

	checkPanes(){
		const treePackage = atom.packages.activePackages["tree-view"];
		
		if(treePackage && !this.treeView){
			const {treeView} = treePackage.mainModule;
			
			if(treeView){
				this.treeView = treeView;
				this.emitter.emit("tree-view-added", treeView);
			}
			
			else if(!this.awaitingToggle){
				this.awaitingToggle = atom.commands.onDidDispatch(cmd => {
					if("tree-view:toggle" === cmd.type){
						this.awaitingToggle.dispose();
						this.disposables.remove(this.awaitingToggle);
						delete this.awaitingToggle;
						
						const {treeView} = treePackage.mainModule;
						this.treeView = treeView
						this.emitter.emit("tree-view-added", treeView);
					}
				});
				this.disposables.add(this.awaitingToggle);
			}
		}
		
		else if(!treePackage && this.treeView){
			this.treeView = null;
			this.emitter.emit("tree-view-removed");
		}
	}



	checkMotif(){
		
		// Spawn a dummy node, snag its computed style, then shoot it
		const node = document.createElement("div");
		node.className = "theme-colour-check";
		document.body.appendChild(node);
		const colour = window.getComputedStyle(node).backgroundColor;
		node.remove();
		
		// Coerce the "rgb(1, 2, 3)" pattern into an HSL array
		const rgb = colour.match(/[\d.]+(?=[,)])/g);
		const hsl = this.rgbToHSL(rgb);
		this.lightTheme = hsl[2] >= .5;
	}
	
	
	
	/**
	 * Convert an RGB colour to HSL.
	 *
	 * @param {Array} channels - An array holding each RGB component
	 * @return {Array}
	 */
	rgbToHSL(channels){
		if(!channels) return;
		
		const r     = channels[0] / 255;
		const g     = channels[1] / 255;
		const b     = channels[2] / 255;
		const min   = Math.min(r, g, b);
		const max   = Math.max(r, g, b);
		const lum   = (max + min) / 2;
		const delta = max - min;
		const sat   = lum < .5
			? (delta / (max + min))
			: (delta / (2 - max - min));
		
		let hue;
		switch(max){
			case r:  hue =     (g - b) / delta; break;
			case g:  hue = 2 + (b - r) / delta; break;
			default: hue = 4 + (r - g) / delta; break;
		}
		
		hue /= 6;
		
		if(hue < 0)
			hue += 1;
		
		return [ hue || 0, sat || 0, lum || 0 ];
	}
	
	
	fixOffset(){
		const styles    = document.styleSheets;
		const numStyles = styles.length;
		
		for(let s = 0; s < numStyles; ++s){
			const rules    = styles[s].cssRules;
			const numRules = rules.length;
			
			for(let r = 0; r < numRules; ++r){
				const selector = ".list-group .icon::before, .list-tree .icon::before";
				const rule = rules[r];
				
				if(rule.selectorText === selector && rule.style.top){
					const offset = rule.style.top;
					rule.style.top = "";
					
					if(this.restoreOffset){
						this.restoreOffset.dispose();
						this.disposables.remove(this.restoreOffset);
					}
					
					this.restoreOffset = new Disposable(_=> rule.style.top = offset);
					this.disposables.add(this.restoreOffset);
					return;
				}
			}
		}
	}
}


module.exports = new UI();