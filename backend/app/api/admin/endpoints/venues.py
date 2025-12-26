from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.venue import Venue
from app.schemas.venue import VenueCreate, VenueResponse
from app.core.dependencies import get_current_admin

router = APIRouter()

@router.get("/", response_model=List[VenueResponse])
def get_all_venues(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    venues = db.query(Venue).offset(skip).limit(limit).all()
    return venues

@router.post("/", response_model=VenueResponse, status_code=status.HTTP_201_CREATED)
def create_venue(
    venue_data: VenueCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    new_venue = Venue(
        name=venue_data.name,
        location=venue_data.location,
        seat_map=venue_data.seat_map,
        capacity=venue_data.capacity
    )
    
    db.add(new_venue)
    db.commit()
    db.refresh(new_venue)
    
    return new_venue

@router.get("/{venue_id}", response_model=VenueResponse)
def get_venue(
    venue_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )
    return venue

