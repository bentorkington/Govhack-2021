// Moments a bit funky with typescript
import { Moment } from 'moment';
import moment from 'moment';

export class GeoData {
	name: string;
	type: string;
	features: Features[];

	constructor(data: any) {
		this.name = data['name'];
		this.type = data['type'];
		this.features = data['features'].map((e) => {
			return {
				geometry: {
					...e['geometry'],
					coordinates: [
						parseFloat(e['geometry']['coordinates'][1]),
						parseFloat(e['geometry']['coordinates'][0])
					]
				},
				type: e['type'],
				properties: {
					start: moment(e['properties']['Start'], 'DD/MM/YYYY hh:mm a'),
					end: moment(e['properties']['End'], 'DD/MM/YYYY hh:mm a'),
					city: e['properties']['City'],
					event: e['properties']['Event'],
					information: e['properties']['Information'],
					location: e['properties']['Location'],
					id: e['properties']['id']
				}
			};
		});
	}
}

export interface Features {
	geometry: Geometry;
	properties: Properties;
	type: string;
}

export interface Geometry {
	coordinates: [number, number];
	type: string;
}

export interface Properties {
	city: string;
	end: Moment;
	event: string;
	information: string;
	location: string;
	start: Moment;
	id: string;
}
