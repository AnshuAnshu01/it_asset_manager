"""Generator-based processing for large datasets and report generation."""
from typing import Generator, Any, List, Dict
from sqlalchemy.orm import Session


def batch_record_generator(query, batch_size: int = 100) -> Generator[Any, None, None]:
    """
    Generator yielding records in chunks to prevent large dataset memory overhead.
    Demonstrates yield and memory-efficient streaming.
    """
    offset = 0
    while True:
        records = query.offset(offset).limit(batch_size).all()
        if not records:
            break
        for record in records:
            yield record
        offset += batch_size


def report_row_generator(items: List[Any], transform_func) -> Generator[Dict[str, Any], None, None]:
    """
    Generator function that transforms rows lazily using yield.
    """
    for item in items:
        yield transform_func(item)


def ticket_stream_generator(tickets: List[Any]) -> Generator[str, None, None]:
    """
    Stream ticket data line by line in CSV-like format.
    """
    yield "ticket_id,title,category,priority,status,created_at\n"
    for t in tickets:
        ticket_id = getattr(t, "ticket_id", getattr(t, "id", ""))
        title = getattr(t, "title", "").replace(",", " ")
        category = getattr(t, "category", "")
        priority = getattr(t, "priority", "")
        status = getattr(t, "status", "")
        created_at = str(getattr(t, "created_at", ""))
        yield f"{ticket_id},{title},{category},{priority},{status},{created_at}\n"
