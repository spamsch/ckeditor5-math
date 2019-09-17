import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

import { toWidget } from '@ckeditor/ckeditor5-widget/src/utils';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';

import MathCommand from './mathcommand';

import { renderEquation } from './utils';

export default class MathEditing extends Plugin {
	static get requires() {
		return [ Widget ];
	}

	static get pluginName() {
		return 'MathEditing';
	}

	init() {
		const editor = this.editor;
		editor.commands.add( 'math', new MathCommand( editor ) );

		this._defineSchema();
		this._defineConverters();
	}

	_defineSchema() {
		const schema = this.editor.model.schema;

		schema.register( 'mathtex', {
			allowWhere: '$text',
			isInline: true,
			isObject: true,
			allowAttributes: [ 'equation', 'type', 'display' ]
		} );
	}

	_defineConverters() {
		const conversion = this.editor.conversion;

		
		// View -> Model
		conversion.for( 'upcast' )
			// MathJax inline way (e.g. <script type="math/tex">\sqrt{\frac{a}{b}}</script>)
			.elementToElement( {
				view: {
					name: 'script',
					attributes: {
						type: 'math/tex'
					}
				},
				model: ( viewElement, modelWriter ) => {
					const equation = viewElement.getChild( 0 ).data.trim();
					return modelWriter.createElement( 'mathtex', { equation, type: 'script', display: false } );
				}
			} )
			// MathJax display way (e.g. <script type="math/tex; mode=display">\sqrt{\frac{a}{b}}</script>)
			.elementToElement( {
				view: {
					name: 'script',
					attributes: {
						type: 'math/tex; mode=display'
					}
				},
				model: ( viewElement, modelWriter ) => {
					const equation = viewElement.getChild( 0 ).data.trim();
					return modelWriter.createElement( 'mathtex', { equation, type: 'script', display: true } );
				}
			} )
			// CKEditor 4 way (e.g. <span class="math-tex">\( \sqrt{\frac{a}{b}} \)</span>)
			.elementToElement( {
				view: {
					name: 'span',
					classes: [ 'math-tex' ]
				},
				model: ( viewElement, modelWriter ) => {
					let equation = viewElement.getChild( 0 ).data.trim();

					// Remove delimiters (e.g. \( \) or \[ \])
					const hasInlineDelimiters = equation.includes( '\\(' ) && equation.includes( '\\)' );
					const hasDisplayDelimiters = equation.includes( '\\[' ) && equation.includes( '\\]' );
					if ( hasInlineDelimiters || hasDisplayDelimiters ) {
						equation = equation.substring( 2, equation.length - 2 ).trim();
					}

					return modelWriter.createElement( 'mathtex', { equation, type: 'span', display: hasDisplayDelimiters } );
				}
			} );

		// Model -> View (element)
		conversion.for( 'editingDowncast' ).elementToElement( {
			model: 'mathtex',
			view: ( modelItem, viewWriter ) => {
				const widgetElement = createMathtexEditingView( modelItem, viewWriter );
				return toWidget( widgetElement, viewWriter );
			}
		} );

		// Model -> Data
		conversion.for( 'dataDowncast' ).elementToElement( {
			model: 'mathtex',
			view: createMathtexView
		} );

		// Create view for editor
		function createMathtexEditingView( modelItem, viewWriter ) {
			const equation = modelItem.getAttribute( 'equation' );
			const display = modelItem.getAttribute( 'display' );

			const styles = 'user-select: none; ' + (display ? 'display: block;' : 'display: inline-block;');
			const classes = 'ck-math-tex ' + (display ? 'ck-math-tex-display' : 'ck-math-tex-inline');

			// CKEngine render multiple times if using span instead of div
			const mathtexView = viewWriter.createContainerElement( 'div', {
				style: styles,
				class: classes
			} );

			// Div is formatted as parent container
			const uiElement = viewWriter.createUIElement( 'div', null, function( domDocument ) {
				const domElement = this.toDomElement( domDocument );

				renderEquation( equation, domElement, 'mathjax', display );

				return domElement;
			} );

			viewWriter.insert( viewWriter.createPositionAt( mathtexView, 0 ), uiElement );

			return mathtexView;
		}

		// Create view for data
		function createMathtexView( modelItem, viewWriter ) {
			const equation = modelItem.getAttribute( 'equation' );
			const type = modelItem.getAttribute( 'type' );
			const display = modelItem.getAttribute( 'display' );

			if ( type === 'span' ) {
				const mathtexView = viewWriter.createContainerElement( 'span', {
					class: 'math-tex'
				} );
	
				if ( display ) {
					viewWriter.insert( viewWriter.createPositionAt( mathtexView, 0 ), viewWriter.createText( '\\[' + equation + '\\]' ) );
				} else {
					viewWriter.insert( viewWriter.createPositionAt( mathtexView, 0 ), viewWriter.createText( '\\(' + equation + '\\)' ) );
				}

				return mathtexView;
			} else {
				const mathtexView = viewWriter.createContainerElement( 'script', {
					type: display ? 'math/tex; mode=display': 'math/tex'
				} );
	
				viewWriter.insert( viewWriter.createPositionAt( mathtexView, 0 ), viewWriter.createText( equation ) );

				return mathtexView;
			}
		}
	}
}
