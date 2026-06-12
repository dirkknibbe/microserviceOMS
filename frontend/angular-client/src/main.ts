import { bootstrapApplication } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { InMemoryCache } from '@apollo/client/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

// No global Material imports here: standalone components declare their own
// Material deps, so importing modules at bootstrap only bloats the initial bundle.
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    provideApollo(() => {
      const httpLink = inject(HttpLink);
      return {
        link: httpLink.create({ uri: 'http://localhost:4000/graphql' }),
        cache: new InMemoryCache(),
      };
    })
  ]
}).catch(err => console.error(err));
